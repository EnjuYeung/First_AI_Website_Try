// AI Features have been removed.
import { Subscription } from "../types";

export const findServiceIcon = async (serviceName: string): Promise<string | null> => {
  return null;
};

export const analyzeSubscriptions = async (subscriptions: Subscription[]): Promise<string> => {
  return "AI Analysis is disabled.";
};

export const chatWithAdvisor = async (history: { role: string, content: string }[], newMessage: string, subscriptions: Subscription[]) => {
  return "AI Chat is disabled.";
};

export const analyzeFamilyPlan = async (imageBase64: string): Promise<string> => {
  return "AI features are disabled.";
};
