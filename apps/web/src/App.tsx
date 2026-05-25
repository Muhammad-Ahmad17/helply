import { Routes, Route } from "react-router-dom";
import HomePage from "@/pages/HomePage";
import LoginPage from "@/pages/LoginPage";
import AuthCallbackPage from "@/pages/AuthCallbackPage";
import DashboardLayout from "@/pages/dashboard/DashboardLayout";
import DashboardPage from "@/pages/dashboard/DashboardPage";
import NewBotPage from "@/pages/dashboard/NewBotPage";
import BotDetailPage from "@/pages/dashboard/BotDetailPage";
import EmbedPage from "@/pages/EmbedPage";
import AdminPage from "@/pages/AdminPage";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/auth/callback" element={<AuthCallbackPage />} />
      <Route path="/admin" element={<AdminPage />} />
      <Route path="/embed/:botId" element={<EmbedPage />} />
      <Route path="/dashboard" element={<DashboardLayout />}>
        <Route index element={<DashboardPage />} />
        <Route path="bots/new" element={<NewBotPage />} />
        <Route path="bots/:id" element={<BotDetailPage />} />
      </Route>
    </Routes>
  );
}
