import React from "react";
import ErrorPopupCard from "./ErrorPopupCard";
import { getErrorCode } from "@/lib/report-error";

export class ErrorBoundary extends React.Component<{
  children: React.ReactNode;
}, { hasError: boolean; error: any }> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }
  componentDidCatch(error: any, errorInfo: any) {
    // Log error to monitoring service if needed
    // console.error(error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return (
        <ErrorPopupCard
          title="Facing some error"
          message="Please try again."
          code={getErrorCode({
            title: this.state.error?.name,
            message: this.state.error?.message,
          })}
          onRetry={() => window.location.reload()}
          retryLabel="Reload"
        />
      );
    }
    return this.props.children;
  }
}
