// groupIdEnforcer.ts

import { Middleware } from 'your-middleware-library'; // ensure to import your middleware library

const groupIdEnforcer: Middleware = (req, res, next) => {
    const { group_id, tenant_scope } = req.body;

    // Check if tenant_scope is present
    if (!tenant_scope) {
        return res.status(400).json({ error: 'Missing tenant scope' }); // hard fail
    }

    // Enforce group_id for write operations
    if (req.method === 'POST' || req.method === 'PUT' || req.method === 'DELETE') {
        if (!group_id) {
            return res.status(400).json({ error: 'Missing group_id for write operation' }); // hard fail
        }
    }

    next();
};

export default groupIdEnforcer;
