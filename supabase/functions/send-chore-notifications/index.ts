import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
// Using specific versions from package.json
import { StandardDateAdapter, OccurrenceGenerator } from "https://esm.sh/@rschedule/standard-date-adapter@1.5.0";
import { Rule, DateTime } from "https://esm.sh/@rschedule/core@1.5.0";

console.log("send-chore-notifications Function starting...");

// Placeholder for FCM Server Key - should be set as an environment variable in Supabase
const FCM_SERVER_KEY = Deno.env.get("FCM_SERVER_KEY");
const FIREBASE_PROJECT_ID = "chores-25a18"; // User provided

interface ChoreFromSupabase {
  id: string;
  title: string; // Changed from name
  user_id: string;
  due_date: string | null; // ISO string from Supabase
  recurrence: any | null; // Changed from recurrence_rule
  done: boolean; // Changed from is_completed
}

interface UserFCMTokenResult {
  fcm_token: string;
}

// Helper function to determine if a chore is due today
function isChoreDueToday(chore: ChoreFromSupabase, todayJs: Date): boolean {
  const todayStartAdapter = new StandardDateAdapter(new Date(todayJs.getFullYear(), todayJs.getMonth(), todayJs.getDate()));
  const todayEndAdapter = new StandardDateAdapter(new Date(todayJs.getFullYear(), todayJs.getMonth(), todayJs.getDate(), 23, 59, 59, 999));

  if (chore.due_date) {
    const dueDateJs = new Date(chore.due_date);
    const dueDateAdapter = new StandardDateAdapter(dueDateJs);
    
    return dueDateAdapter.date.getFullYear() === todayStartAdapter.date.getFullYear() &&
           dueDateAdapter.date.getMonth() === todayStartAdapter.date.getMonth() &&
           dueDateAdapter.date.getDate() === todayStartAdapter.date.getDate();
  }

  if (chore.recurrence) { 
    try {
      const ruleOptions = { ...chore.recurrence }; 
      if (typeof ruleOptions.start === 'string') {
        ruleOptions.start = new StandardDateAdapter(new Date(ruleOptions.start));
      }
      if (typeof ruleOptions.until === 'string') {
        ruleOptions.until = new StandardDateAdapter(new Date(ruleOptions.until));
      }
      if (!ruleOptions.start) {
        console.warn(`Chore ${chore.id} recurrence rule missing start date.`);
        return false;
      }
      
      const rule = new Rule(ruleOptions, { dateAdapter: StandardDateAdapter });

      const occurrencesToday: OccurrenceGenerator = rule.occurrences({
        start: todayStartAdapter,
        end: todayEndAdapter,
      });
      
      return !occurrencesToday.next().done;
    } catch (e) {
      console.error(`Error processing recurrence rule for chore ${chore.id}:`, e.message, "Rule data:", JSON.stringify(chore.recurrence)); 
      return false;
    }
  }
  return false; 
}

serve(async (req: Request) => {
  if (!FCM_SERVER_KEY) {
    return new Response(
      JSON.stringify({ error: "FCM_SERVER_KEY is not set in environment variables." }),
      { headers: { "Content-Type": "application/json" }, status: 500 }
    );
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      console.error("SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is not set.");
      return new Response(
        JSON.stringify({ error: "Supabase environment variables not set." }),
        { headers: { "Content-Type": "application/json" }, status: 500 }
      );
    }

    const supabaseClient: SupabaseClient = createClient(supabaseUrl, supabaseServiceRoleKey);

    // 1. Fetch all non-completed chores
    const { data: allChoresData, error: choresError } = await supabaseClient
      .from("chores")
      .select("id, title, user_id, due_date, recurrence, done") // Use correct field names
      .eq("done", false); // Use correct field name

    if (choresError) {
      console.error("Error fetching chores:", choresError.message);
      return new Response(
        JSON.stringify({ error: "Failed to fetch chores", details: choresError.message }),
        { headers: { "Content-Type": "application/json" }, status: 500 }
      );
    }

    const allChores = allChoresData as ChoreFromSupabase[];

    if (!allChores || allChores.length === 0) {
      console.log("No non-completed chores found.");
      return new Response(
        JSON.stringify({ message: "No non-completed chores found to process." }),
        { headers: { "Content-Type": "application/json" }, status: 200 }
      );
    }

    const todayJs = new Date();
    const dueChoresToday: ChoreFromSupabase[] = [];

    for (const chore of allChores) {
      if (isChoreDueToday(chore, todayJs)) {
        dueChoresToday.push(chore);
      }
    }

    if (dueChoresToday.length === 0) {
      console.log("No chores are due today.");
      return new Response(
        JSON.stringify({ message: "No chores are due today." }),
        { headers: { "Content-Type": "application/json" }, status: 200 }
      );
    }

    console.log(`Found ${dueChoresToday.length} chores due today.`);
    let notificationsSent = 0;
    let notificationsFailed = 0;
    const fcmEndpoint = `https://fcm.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/messages:send`;

    for (const chore of dueChoresToday) {
      const { data: fcmTokensData, error: tokensError } = await supabaseClient
        .from("user_fcm_tokens")
        .select("fcm_token")
        .eq("user_id", chore.user_id);

      if (tokensError) {
        console.error(`Error fetching FCM tokens for user ${chore.user_id}:`, tokensError.message);
        notificationsFailed++;
        continue;
      }
      
      const fcmTokens = fcmTokensData as UserFCMTokenResult[];

      if (!fcmTokens || fcmTokens.length === 0) {
        console.log(`No FCM tokens found for user ${chore.user_id} for chore "${chore.title}".`); // Use title
        continue;
      }

      for (const tokenRecord of fcmTokens) {
        const fcmToken = tokenRecord.fcm_token;
        const fcmMessagePayload = {
          message: {
            to: fcmToken,
            notification: {
              title: "Chore Due!",
              body: `Your chore "${chore.title}" is due today.`, // Use title
              icon: "/icon.png", 
            },
            data: { choreId: chore.id } 
          }
        };

        try {
          const fcmResponse = await fetch(fcmEndpoint, {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${FCM_SERVER_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(fcmMessagePayload),
          });

          const fcmResultText = await fcmResponse.text();
          
          if (fcmResponse.ok) {
            try {
                const fcmResultJson = JSON.parse(fcmResultText);
                 if (fcmResultJson.name) {
                    console.log(`Successfully sent notification for chore "${chore.title}" to token ${fcmToken}`); // Use title
                    notificationsSent++;
                } else {
                    notificationsFailed++;
                    console.error(`FCM success response, but no message name. Chore "${chore.title}", token ${fcmToken}:`, fcmResultJson); // Use title
                }
            } catch (parseError) {
                notificationsFailed++;
                console.error(`Error parsing FCM JSON success response for chore "${chore.title}", token ${fcmToken}. Raw response:`, fcmResultText, parseError.message); // Use title
            }
          } else { 
            notificationsFailed++;
            console.error(`FCM API Error (${fcmResponse.status}) for chore "${chore.title}", token ${fcmToken}. Raw response:`, fcmResultText); // Use title
            try {
                const fcmErrorJson = JSON.parse(fcmResultText);
                const errorCode = fcmErrorJson.error?.details?.[0]?.errorCode || fcmErrorJson.error?.status;
                if (errorCode === "UNREGISTERED" || fcmErrorJson.error?.message?.includes("Requested entity was not found") || fcmResponse.status === 404 || fcmResponse.status === 410) {
                  console.log(`Token ${fcmToken} is unregistered or invalid. Deleting from database.`);
                  const { error: deleteError } = await supabaseClient.from("user_fcm_tokens").delete().eq("fcm_token", fcmToken);
                  if (deleteError) {
                      console.error(`Failed to delete unregistered token ${fcmToken}:`, deleteError.message);
                  }
                }
            } catch(e) { /* ignore parse error if not json */ }
          }
        } catch (fetchError) { 
          notificationsFailed++;
          console.error(`Network error sending FCM for chore "${chore.title}", token ${fcmToken}:`, fetchError.message); // Use title
        }
      }
    }

    return new Response(
      JSON.stringify({
        message: "Chore notification process completed.",
        choresProcessed: allChores.length,
        dueChoresFound: dueChoresToday.length,
        notificationsSent,
        notificationsFailed,
      }),
      { headers: { "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error) {
    console.error("Critical error in Edge Function execution:", error.message, error.stack);
    return new Response(
      JSON.stringify({ error: "Internal server error", details: error.message }),
      { headers: { "Content-Type": "application/json" }, status: 500 }
    );
  }
});
