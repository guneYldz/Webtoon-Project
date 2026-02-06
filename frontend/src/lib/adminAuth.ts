// Auth helper functions for admin panel

export function getAdminToken() {
    if (typeof window === "undefined") return null;
    return localStorage.getItem("admin_token");
}

export function getAuthHeaders() {
    const token = getAdminToken();
    return token
        ? {
            Authorization: `Bearer ${token}`,
        }
        : {};
}

export function isAdminLoggedIn() {
    const token = getAdminToken();
    const role = localStorage.getItem("admin_role");
    return token && role === "admin";
}

export function logout() {
    localStorage.removeItem("admin_token");
    localStorage.removeItem("admin_role");
    localStorage.removeItem("admin_user");
    window.location.href = "/admin/login";
}
