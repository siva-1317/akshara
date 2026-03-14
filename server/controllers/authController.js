import "../config/env.js";
import { OAuth2Client } from "google-auth-library";
import { supabase } from "../config/supabase.js";

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
const DEFAULT_ADMIN = {
  id: "admin-1",
  name: "AKSHARA Admin",
  email: "siva636938@gmail.com",
  password: "admin123",
  role: "admin"
};

const isMissingTableError = (error, tableName) => {
  if (!error) {
    return false;
  }

  const message = String(error.message || "").toLowerCase();
  const details = String(error.details || "").toLowerCase();
  const target = String(tableName || "").toLowerCase();

  return (
    error.code === "PGRST205" ||
    message.includes(`table 'public.${target}'`) ||
    details.includes(`table 'public.${target}'`)
  );
};

const isMissingColumnError = (error, columnName) => {
  if (!error) {
    return false;
  }

  const message = String(error.message || "").toLowerCase();
  const details = String(error.details || "").toLowerCase();
  const target = String(columnName || "").toLowerCase();

  return (
    message.includes("column") &&
    (message.includes("does not exist") || details.includes("does not exist")) &&
    (message.includes(target) || details.includes(target))
  );
};

const approvalStatusFor = (userRole) => (String(userRole || "").toLowerCase() === "admin" ? "approved" : "pending");

const mapUserToResponse = (storedUser, fallback = {}) => ({
  id: storedUser.id,
  name: storedUser.name || fallback.name || "",
  email: storedUser.email || fallback.email || "",
  phoneNumber: storedUser.phone_number || "",
  profession: storedUser.profession || "",
  coins: Number.isFinite(storedUser.coins) ? storedUser.coins : 50,
  avatarUrl: fallback.avatarUrl || null,
  role: storedUser.role || fallback.role || "user",
  approvalStatus: storedUser.approval_status || "approved",
  isBlocked: Boolean(storedUser.is_blocked),
  blockReason: storedUser.block_reason || null
});

const upsertUser = async (user) => {
  const { data: existingUser, error: existingUserError } = await supabase
    .from("users")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  if (existingUserError) {
    throw existingUserError;
  }

  if (!existingUser) {
    const insertPayload = {
      id: user.id,
      name: user.name,
      email: user.email,
      coins: 50,
      role: user.role || "user",
      approval_status: approvalStatusFor(user.role || "user")
    };

    let { error } = await supabase.from("users").insert(insertPayload);

    if (isMissingColumnError(error, "approval_status")) {
      const { approval_status: _ignored, ...fallbackPayload } = insertPayload;
      const retry = await supabase.from("users").insert(fallbackPayload);
      error = retry.error;
    }

    if (error) {
      throw error;
    }

    const adminNotification = {
      user_id: DEFAULT_ADMIN.id,
      type: "approval",
      title: "New user waiting for approval",
      message: `${user.name || "New user"} (${user.email || "no email"}) requested access.`
    };

    const { error: notifyError } = await supabase.from("notifications").insert(adminNotification);
    if (!isMissingTableError(notifyError, "notifications") && notifyError) {
      throw notifyError;
    }

    return;
  }

  const updatePayload = {};
  if (!existingUser.name && user.name) {
    updatePayload.name = user.name;
  }
  if (!existingUser.email && user.email) {
    updatePayload.email = user.email;
  }
  if (existingUser.coins == null) {
    updatePayload.coins = 50;
  }
  if (!existingUser.role && user.role) {
    updatePayload.role = user.role;
  }

  if (Object.keys(updatePayload).length) {
    const { error } = await supabase.from("users").update(updatePayload).eq("id", user.id);

    if (error) {
      throw error;
    }
  }
};

export const login = async (req, res, next) => {
  try {
    const { credential, email, password } = req.body;

    if (email && password) {
      if (
        email.trim().toLowerCase() === DEFAULT_ADMIN.email.toLowerCase() &&
        password === DEFAULT_ADMIN.password
      ) {
        await upsertUser(DEFAULT_ADMIN);

        const { data: storedAdmin, error: adminError } = await supabase
          .from("users")
          .select("*")
          .eq("id", DEFAULT_ADMIN.id)
          .single();

        if (adminError) {
          throw adminError;
        }

        return res.json({
          message: "Admin login successful.",
          user: mapUserToResponse(storedAdmin, {
            ...DEFAULT_ADMIN,
            avatarUrl: null
          })
        });
      }

      return res.status(401).json({
        message: "Invalid credentials. Admin access is limited to the default admin login."
      });
    }

    if (!credential) {
      return res.status(400).json({ message: "Google credential is required." });
    }

    const ticket = await client.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID
    });

    const payload = ticket.getPayload();

    const oauthEmail = String(payload?.email || "").trim().toLowerCase();
    const isAdminEmail = oauthEmail && oauthEmail === String(DEFAULT_ADMIN.email || "").trim().toLowerCase();

    const user = isAdminEmail
      ? {
          id: DEFAULT_ADMIN.id,
          name: payload?.name || DEFAULT_ADMIN.name,
          email: DEFAULT_ADMIN.email,
          avatarUrl: payload?.picture || null,
          role: "admin"
        }
      : {
          id: payload.sub,
          name: payload.name,
          email: payload.email,
          avatarUrl: payload.picture || null,
          role: "user"
        };

    await upsertUser(user);

    const { data: storedUser, error: userError } = await supabase
      .from("users")
      .select("*")
      .eq("id", user.id)
      .single();

    if (userError) {
      throw userError;
    }

    return res.json({
      message: "Login successful.",
      user: mapUserToResponse(storedUser, user)
    });
  } catch (error) {
    next(error);
  }
};

export const getCurrentUser = async (req, res, next) => {
  try {
    const userId = req.headers["x-user-id"];

    if (!userId) {
      return res.status(400).json({ message: "User ID is required." });
    }

    const { data, error } = await supabase
      .from("users")
      .select("*")
      .eq("id", userId);

    if (error) {
      throw error;
    }

    const storedUser = (data || [])[0] || null;
    if (!storedUser) {
      return res.status(404).json({ message: "User not found. Please log in again." });
    }

    return res.json({
      user: mapUserToResponse(storedUser)
    });
  } catch (error) {
    next(error);
  }
};

export const updateCurrentUser = async (req, res, next) => {
  try {
    const userId = req.headers["x-user-id"];
    const { name, email, phoneNumber = "", profession = "" } = req.body;

    if (!userId) {
      return res.status(400).json({ message: "User ID is required." });
    }

    if (!name?.trim() || !email?.trim()) {
      return res.status(400).json({ message: "Name and email are required." });
    }

    const updatePayload = {
      name: name.trim(),
      email: email.trim(),
      phone_number: phoneNumber.trim() || null,
      profession: profession.trim() || null
    };

    const { data, error } = await supabase
      .from("users")
      .update(updatePayload)
      .eq("id", userId)
      .select("*");

    if (error) {
      throw error;
    }

    const storedUser = (data || [])[0] || null;
    if (!storedUser) {
      return res.status(404).json({ message: "User not found. Please log in again." });
    }

    return res.json({
      message: "Profile updated successfully.",
      user: mapUserToResponse(storedUser)
    });
  } catch (error) {
    next(error);
  }
};
