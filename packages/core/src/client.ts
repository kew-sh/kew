import axios from "axios";

export const client = axios.create({
  baseURL: "/api",
  headers: { "content-type": "application/json" },
});
