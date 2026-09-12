const API_BASE = '/api';

const STU_KEY = 'elite_student_token';
const ADM_KEY = 'elite_admin_token';

function getToken() {
  return getAdminToken() || getStudentToken() || '';
}

function getStudentToken() {
  return localStorage.getItem(STU_KEY) || '';
}

function getAdminToken() {
  return localStorage.getItem(ADM_KEY) || '';
}

function setStudentToken(token) {
  localStorage.setItem(STU_KEY, token);
}

function setAdminToken(token) {
  localStorage.setItem(ADM_KEY, token);
}

function clearToken() {
  localStorage.removeItem(STU_KEY);
  localStorage.removeItem(ADM_KEY);
}

let onUnauthorized = null;
function setOnUnauthorized(fn) {
  onUnauthorized = fn;
}

async function request(path, method = 'GET', body, opts = {}) {
  const headers = { 'Content-Type': 'application/json' };
  let token = opts.token !== undefined ? opts.token : undefined;
  if (token === undefined) {
    if (path.startsWith('/admin')) token = getAdminToken();
    else if (path.startsWith('/student')) token = getStudentToken();
    else token = getAdminToken() || getStudentToken() || '';
  }
  if (token) headers.Authorization = `Bearer ${token}`;
  let res;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      method,
      headers,
      body: body != null ? JSON.stringify(body) : undefined,
    });
  } catch (_) {
    const err = new Error('Network error — check your connection.');
    err.status = 0;
    throw err;
  }
  let data = null;
  try {
    data = await res.json();
  } catch (_) {
    data = null;
  }
  if (res.status === 401 && token && onUnauthorized) onUnauthorized();
  if (!res.ok) {
    const err = new Error((data && data.error) || `Request failed (${res.status})`);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

export {
  request,
  getToken,
  getStudentToken,
  getAdminToken,
  setStudentToken,
  setAdminToken,
  setOnUnauthorized,
  clearToken,
};
export default request;