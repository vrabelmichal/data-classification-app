import { createContext, useContext, useState } from "react";
import type { ReactNode } from "react";

type ReportIssueModalContextType = {
  isOpen: boolean;
  open: () => void;
  close: () => void;
};

const ReportIssueModalContext = createContext<ReportIssueModalContextType | null>(null);

export function ReportIssueModalProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <ReportIssueModalContext.Provider
      value={{
        isOpen,
        open: () => setIsOpen(true),
        close: () => setIsOpen(false),
      }}
    >
      {children}
    </ReportIssueModalContext.Provider>
  );
}

export function useReportIssueModal() {
  const ctx = useContext(ReportIssueModalContext);
  if (!ctx) {
    throw new Error("useReportIssueModal must be used within a ReportIssueModalProvider");
  }
  return ctx;
}
