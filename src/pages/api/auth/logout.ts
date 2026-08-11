import type { APIRoute } from "astro";

export const GET: APIRoute = ({ cookies, redirect }) => {
  cookies.delete("session", {
    path: "/",
  });

  return redirect("/login");
};
