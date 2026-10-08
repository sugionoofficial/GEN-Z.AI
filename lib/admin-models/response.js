//api/admin-models/response.js?v=3001.1
// ========================================
// GEN-Z.AI
// ADMIN MODEL API
// File: api/admin-models/response.js
// ========================================

export const json = (
    res,
    status,
    data
) => {

    return res
        .status(status)
        .json(data);

};
