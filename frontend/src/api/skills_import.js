import axios from "axios";

const http = axios.create({ baseURL: "/api" });

export async function scanSkills(payload) {
  try {
    const r = await http.post("/skills/scan", payload);
    return r.data;
  } catch (err) {
    const status = err.response?.status;
    const detail = err.response?.data?.detail ?? err.message;
    throw { status, detail };
  }
}

export async function importSkills(payload) {
  try {
    const r = await http.post("/skills/import", payload);
    return r.data;
  } catch (err) {
    if (err.response?.status === 409) {
      throw { conflicts: err.response.data.conflicts };
    }
    const status = err.response?.status;
    const detail = err.response?.data?.detail ?? err.message;
    throw { status, detail };
  }
}
