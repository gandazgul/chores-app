/** @typedef {import('astro').APIRoute} APIRoute */

/** @type {APIRoute} */
export const GET = ({ cookies, redirect }) => {
  cookies.delete("session", {
    path: "/",
  });

  return redirect("/login");
};
