import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import { getCurrentUser } from "./api";
import AppNavbar from "./components/Navbar";
import AdminNavbar from "./components/AdminNavbar";
import Landing from "./pages/Landing";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import CreateTest from "./pages/CreateTest";
import TestPage from "./pages/TestPage";
import Result from "./pages/Result";
import History from "./pages/History";
import Review from "./pages/Review";
import Admin from "./pages/Admin";
import Blocked from "./pages/Blocked";

const getStoredUser = () => JSON.parse(localStorage.getItem("aksharaUser") || "null");

const AdminRoute = ({ children }) => {
  const user = getStoredUser();
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  if (user.isBlocked) {
    return <Navigate to="/blocked" replace />;
  }
  return user.role === "admin" ? children : <Navigate to="/dashboard" replace />;
};

const UserRoute = ({ children }) => {
  const user = getStoredUser();
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  if (user.isBlocked) {
    return <Navigate to="/blocked" replace />;
  }
  return user.role === "admin" ? <Navigate to="/admin/dashboard" replace /> : children;
};

const AppLayout = ({ theme, onToggleTheme }) => {
  const location = useLocation();
  const user = getStoredUser();
  const isAdmin = user?.role === "admin";
  const showAdminNavbar = isAdmin && !["/", "/login"].includes(location.pathname);

  const Navbar = showAdminNavbar ? AdminNavbar : AppNavbar;
  return <Navbar theme={theme} onToggleTheme={onToggleTheme} />;
};

export default function App() {
  const [theme, setTheme] = useState(() => localStorage.getItem("aksharaTheme") || "light");
  const [, setSessionVersion] = useState(0);

  useEffect(() => {
    document.body.dataset.theme = theme;
    localStorage.setItem("aksharaTheme", theme);
  }, [theme]);

  useEffect(() => {
    const syncCurrentUser = async () => {
      const storedUser = getStoredUser();
      if (!storedUser?.id) {
        return;
      }

      try {
        const { data } = await getCurrentUser();
        const nextUser = {
          ...data.user,
          avatarUrl: data.user.avatarUrl || storedUser.avatarUrl || null
        };
        const serializedCurrent = JSON.stringify(storedUser);
        const serializedNext = JSON.stringify(nextUser);

        if (serializedCurrent !== serializedNext) {
          localStorage.setItem("aksharaUser", serializedNext);
          setSessionVersion((current) => current + 1);
        }
      } catch (error) {
        console.error(error);
      }
    };

    syncCurrentUser();

    const intervalId = window.setInterval(syncCurrentUser, 15000);
    window.addEventListener("focus", syncCurrentUser);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("focus", syncCurrentUser);
    };
  }, []);

  const toggleTheme = () => {
    setTheme((current) => (current === "light" ? "dark" : "light"));
  };

  return (
    <BrowserRouter>
      <AppLayout theme={theme} onToggleTheme={toggleTheme} />
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        <Route path="/blocked" element={<Blocked />} />
        <Route
          path="/dashboard"
          element={
            <UserRoute>
              <Dashboard />
            </UserRoute>
          }
        />
        <Route
          path="/create-test"
          element={
            <UserRoute>
              <CreateTest />
            </UserRoute>
          }
        />
        <Route
          path="/test/:testId"
          element={
            <UserRoute>
              <TestPage />
            </UserRoute>
          }
        />
        <Route
          path="/result/:testId"
          element={
            <UserRoute>
              <Result />
            </UserRoute>
          }
        />
        <Route
          path="/history"
          element={
            <UserRoute>
              <History />
            </UserRoute>
          }
        />
        <Route
          path="/review/:testId"
          element={
            <UserRoute>
              <Review />
            </UserRoute>
          }
        />
        <Route
          path="/admin/*"
          element={
            <AdminRoute>
              <Admin />
            </AdminRoute>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}
