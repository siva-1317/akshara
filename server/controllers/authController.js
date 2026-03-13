import "dotenv/config";
import { OAuth2Client } from "google-auth-library";
import { supabase } from "../config/supabase.js";

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
const DEFAULT_ADMIN = {
  id: "admin-1",
  name: "AKSHARA Admin",
  email: "admin@gmail.com",
  password: "admin123",
  role: "admin"
};

const mapUserToResponse = (storedUser, fallback = {}) => ({
  id: storedUser.id,
  name: storedUser.name || fallback.name || "",
  email: storedUser.email || fallback.email || "",
  phoneNumber: storedUser.phone_number || "",
  profession: storedUser.profession || "",
  coins: Number.isFinite(storedUser.coins) ? storedUser.coins : 50,
  avatarUrl: fallback.avatarUrl || null,
  role: storedUser.role || fallback.role || "user",
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
    const { error } = await supabase.from("users").insert({
      id: user.id,
      name: user.name,
      email: user.email,
      coins: 50,
      role: user.role || "user"
    });

    if (error) {
      throw error;
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
        email.toLowerCase() === DEFAULT_ADMIN.email &&
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
    const user = {
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

    const { data: storedUser, error } = await supabase
      .from("users")
      .select("*")
      .eq("id", userId)
      .single();

    if (error) {
      throw error;
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

    const { data: storedUser, error } = await supabase
      .from("users")
      .update(updatePayload)
      .eq("id", userId)
      .select("*")
      .single();

    if (error) {
      throw error;
    }

    return res.json({
      message: "Profile updated successfully.",
      user: mapUserToResponse(storedUser)
    });
  } catch (error) {
    next(error);
  }
};
