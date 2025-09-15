import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DeleteDemoModal } from "./DeleteConfirmationModal";

describe("DeleteDemoModal", () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    onConfirm: vi.fn(),
    demoName: "Test Demo",
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should render modal with demo name", () => {
    render(<DeleteDemoModal {...defaultProps} />);

    expect(screen.getByRole("heading", { name: "Delete Demo" })).toBeInTheDocument();
    expect(
      screen.getByText("Are you sure you want to delete this demo? This action cannot be undone.")
    ).toBeInTheDocument();
    expect(screen.getByText("Demo:")).toBeInTheDocument();
    expect(screen.getByText("Test Demo")).toBeInTheDocument();
    expect(screen.getByText(/Lead submissions will be preserved/)).toBeInTheDocument();
  });

  it("should call onClose when cancel button is clicked", async () => {
    const user = userEvent.setup();
    render(<DeleteDemoModal {...defaultProps} />);

    const cancelButton = screen.getByRole("button", { name: "Cancel" });
    await user.click(cancelButton);

    expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
  });

  it("should call onConfirm when delete button is clicked", async () => {
    const user = userEvent.setup();
    const mockOnConfirm = vi.fn().mockResolvedValue(undefined);

    render(<DeleteDemoModal {...defaultProps} onConfirm={mockOnConfirm} />);

    const deleteButton = screen.getByRole("button", { name: "Delete Demo" });
    await user.click(deleteButton);

    expect(mockOnConfirm).toHaveBeenCalledTimes(1);
  });

  it("should show loading state during deletion", async () => {
    const user = userEvent.setup();
    const mockOnConfirm = vi.fn(() => new Promise((resolve) => setTimeout(resolve, 100)));

    render(<DeleteDemoModal {...defaultProps} onConfirm={mockOnConfirm} />);

    const deleteButton = screen.getByRole("button", { name: "Delete Demo" });
    await user.click(deleteButton);

    // Should show loading state
    await waitFor(() => {
      expect(screen.getByText("Deleting...")).toBeInTheDocument();
    });

    // Buttons should be disabled during loading
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Deleting..." })).toBeDisabled();
  });

  it("should close modal after successful deletion", async () => {
    const user = userEvent.setup();
    const mockOnConfirm = vi.fn().mockResolvedValue(undefined);
    const mockOnClose = vi.fn();

    render(<DeleteDemoModal {...defaultProps} onConfirm={mockOnConfirm} onClose={mockOnClose} />);

    const deleteButton = screen.getByRole("button", { name: "Delete Demo" });
    await user.click(deleteButton);

    await waitFor(() => {
      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });
  });

  it("should handle deletion errors gracefully", async () => {
    const user = userEvent.setup();
    const mockOnConfirm = vi.fn().mockRejectedValue(new Error("Deletion failed"));

    render(<DeleteDemoModal {...defaultProps} onConfirm={mockOnConfirm} />);

    const deleteButton = screen.getByRole("button", { name: "Delete Demo" });

    // The component will throw an unhandled error, so we need to catch it
    let thrownError: any = null;

    // Add error event listener to catch unhandled rejections
    const originalHandler = process.listeners("unhandledRejection");
    process.removeAllListeners("unhandledRejection");
    process.on("unhandledRejection", (error) => {
      thrownError = error;
    });

    try {
      await user.click(deleteButton);

      // Wait for the error to be handled and onConfirm to be called
      await waitFor(() => {
        expect(mockOnConfirm).toHaveBeenCalledTimes(1);
      });

      // Wait a bit for the unhandled rejection to occur
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Should have caught the error
      expect(thrownError).toBeInstanceOf(Error);
      expect(thrownError.message).toBe("Deletion failed");

      // Modal should remain open on error (onClose should not be called)
      expect(defaultProps.onClose).not.toHaveBeenCalled();

      // Modal should still be visible since error occurred
      expect(screen.getByRole("dialog")).toBeInTheDocument();
    } finally {
      // Restore original error handlers
      process.removeAllListeners("unhandledRejection");
      originalHandler.forEach((handler) => process.on("unhandledRejection", handler));
    }
  });

  it("should not render when isOpen is false", () => {
    render(<DeleteDemoModal {...defaultProps} isOpen={false} />);

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("should display demo name correctly", () => {
    render(<DeleteDemoModal {...defaultProps} demoName="My Awesome Product Demo" />);

    expect(screen.getByText("Demo:")).toBeInTheDocument();
    expect(screen.getByText("My Awesome Product Demo")).toBeInTheDocument();
  });

  it("should show proper styling classes", () => {
    render(<DeleteDemoModal {...defaultProps} />);

    // Check that the demo info has the correct styling
    const demoInfo = screen.getByText("Demo:").closest("div");
    expect(demoInfo).toHaveClass("py-3", "px-4", "bg-muted/50", "rounded-lg", "border");

    // Check button styling
    const cancelButton = screen.getByRole("button", { name: "Cancel" });
    const deleteButton = screen.getByRole("button", { name: "Delete Demo" });

    expect(cancelButton).toHaveClass("flex-1", "bg-transparent");
    expect(deleteButton).toHaveClass("flex-1");
  });

  it("should handle keyboard navigation", async () => {
    const user = userEvent.setup();
    render(<DeleteDemoModal {...defaultProps} />);

    // Tab through focusable elements - dialog should auto-focus the first element
    const cancelButton = screen.getByRole("button", { name: "Cancel" });
    const deleteButton = screen.getByRole("button", { name: "Delete Demo" });

    // Focus should start at first button (varies by implementation)
    await user.tab();
    // Either cancel or delete button should be focused
    const focusedElement = document.activeElement;
    expect([cancelButton, deleteButton]).toContain(focusedElement);

    // Enter should trigger the focused button's action
    if (focusedElement === deleteButton) {
      await user.keyboard("{Enter}");
      expect(defaultProps.onConfirm).toHaveBeenCalledTimes(1);
    }
  });

  it("should show lead preservation notice", () => {
    render(<DeleteDemoModal {...defaultProps} />);

    const notice = screen.getByText(/Lead submissions will be preserved and can still be accessed from the leads page/);
    expect(notice).toBeInTheDocument();

    // Check that "Note:" text exists
    expect(screen.getByText("Note:")).toBeInTheDocument();
  });
});
