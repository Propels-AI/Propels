import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import EditorHeader, { EditorHeaderProps } from "./EditorHeader";

const defaultProps: EditorHeaderProps = {
  demoId: "test-demo-id",
  demoName: "Test Demo",
  onChangeName: vi.fn(),
  savingTitle: false,
  savingDemo: false,
  demoStatus: "DRAFT",
  togglingStatus: false,
  isPreviewing: false,
  previewableCount: 3,
  currentPreviewIndex: 0,
  onSelectPreviewIndex: vi.fn(),
  onPrevPreview: vi.fn(),
  onNextPreview: vi.fn(),
  onSaveTitle: vi.fn(),
  onPreview: vi.fn(),
  onToggleStatus: vi.fn(),
  onDelete: vi.fn(),
  onOpenShareDialog: vi.fn(),
  onCopyPublicUrl: vi.fn(),
  onCopyEmbed: vi.fn(),
  onSave: vi.fn(),
};

describe("EditorHeader", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Title Display", () => {
    it("shows title in display mode by default", () => {
      render(<EditorHeader {...defaultProps} />);

      expect(screen.getByText("Test Demo")).toBeInTheDocument();
      expect(screen.getByTitle("Edit demo name")).toBeInTheDocument();
      expect(screen.queryByDisplayValue("Test Demo")).not.toBeInTheDocument();
    });

    it("shows 'Untitled Demo' when demoName is empty", () => {
      render(<EditorHeader {...defaultProps} demoName="" />);

      expect(screen.getByText("Untitled Demo")).toBeInTheDocument();
    });

    it("shows 'Untitled Demo' when demoName is undefined", () => {
      render(<EditorHeader {...defaultProps} demoName={undefined as any} />);

      expect(screen.getByText("Untitled Demo")).toBeInTheDocument();
    });
  });

  describe("Title Editing", () => {
    it("enters edit mode when clicking edit icon", async () => {
      const user = userEvent.setup();
      render(<EditorHeader {...defaultProps} />);

      const editButton = screen.getByTitle("Edit demo name");
      await user.click(editButton);

      expect(screen.getByDisplayValue("Test Demo")).toBeInTheDocument();
      expect(screen.getByTestId("title-save-button")).toBeInTheDocument();
      expect(screen.queryByText("Test Demo")).not.toBeInTheDocument(); // Title hidden in edit mode
    });

    it("shows empty input for 'Untitled Demo'", async () => {
      const user = userEvent.setup();
      render(<EditorHeader {...defaultProps} demoName="Untitled Demo" />);

      const editButton = screen.getByTitle("Edit demo name");
      await user.click(editButton);

      const input = screen.getByPlaceholderText("Enter demo name");
      expect(input).toHaveValue("");
    });

    it("shows current title in input for custom titles", async () => {
      const user = userEvent.setup();
      render(<EditorHeader {...defaultProps} demoName="My Custom Demo" />);

      const editButton = screen.getByTitle("Edit demo name");
      await user.click(editButton);

      expect(screen.getByDisplayValue("My Custom Demo")).toBeInTheDocument();
    });

    it("updates input value when typing", async () => {
      const user = userEvent.setup();
      render(<EditorHeader {...defaultProps} />);

      const editButton = screen.getByTitle("Edit demo name");
      await user.click(editButton);

      const input = screen.getByDisplayValue("Test Demo");
      await user.clear(input);
      await user.type(input, "New Demo Name");

      expect(input).toHaveValue("New Demo Name");
    });

    it("saves title when clicking save button", async () => {
      const user = userEvent.setup();
      const mockOnChangeName = vi.fn();
      const mockOnSaveTitle = vi.fn().mockResolvedValue(undefined);

      render(<EditorHeader {...defaultProps} onChangeName={mockOnChangeName} onSaveTitle={mockOnSaveTitle} />);

      // Enter edit mode
      const editButton = screen.getByTitle("Edit demo name");
      await user.click(editButton);

      // Type new name
      const input = screen.getByDisplayValue("Test Demo");
      await user.clear(input);
      await user.type(input, "New Demo Name");

      // Click save
      const saveButton = screen.getByTestId("title-save-button");
      await user.click(saveButton);

      expect(mockOnChangeName).toHaveBeenCalledWith("New Demo Name");
      expect(mockOnSaveTitle).toHaveBeenCalledWith("New Demo Name");

      // Should exit edit mode
      await waitFor(() => {
        expect(screen.queryByDisplayValue("New Demo Name")).not.toBeInTheDocument();
      });
    });

    it("saves title when pressing Enter", async () => {
      const user = userEvent.setup();
      const mockOnChangeName = vi.fn();
      const mockOnSaveTitle = vi.fn().mockResolvedValue(undefined);

      render(<EditorHeader {...defaultProps} onChangeName={mockOnChangeName} onSaveTitle={mockOnSaveTitle} />);

      // Enter edit mode
      const editButton = screen.getByTitle("Edit demo name");
      await user.click(editButton);

      // Type new name and press Enter
      const input = screen.getByDisplayValue("Test Demo");
      await user.clear(input);
      await user.type(input, "New Demo Name{Enter}");

      expect(mockOnChangeName).toHaveBeenCalledWith("New Demo Name");
      expect(mockOnSaveTitle).toHaveBeenCalledWith("New Demo Name");
    });

    it("cancels edit when pressing Escape", async () => {
      const user = userEvent.setup();
      const mockOnChangeName = vi.fn();
      const mockOnSaveTitle = vi.fn();

      render(<EditorHeader {...defaultProps} onChangeName={mockOnChangeName} onSaveTitle={mockOnSaveTitle} />);

      // Enter edit mode
      const editButton = screen.getByTitle("Edit demo name");
      await user.click(editButton);

      // Type new name and press Escape
      const input = screen.getByDisplayValue("Test Demo");
      await user.clear(input);
      await user.type(input, "New Demo Name{Escape}");

      // Should not save
      expect(mockOnChangeName).not.toHaveBeenCalled();
      expect(mockOnSaveTitle).not.toHaveBeenCalled();

      // Should exit edit mode and show original title
      await waitFor(() => {
        expect(screen.getByText("Test Demo")).toBeInTheDocument();
        expect(screen.queryByDisplayValue("New Demo Name")).not.toBeInTheDocument();
      });
    });

    it("cancels edit when clicking outside input", async () => {
      const user = userEvent.setup();
      const mockOnChangeName = vi.fn();
      const mockOnSaveTitle = vi.fn();

      render(
        <div>
          <EditorHeader {...defaultProps} onChangeName={mockOnChangeName} onSaveTitle={mockOnSaveTitle} />
          <div data-testid="outside-element">Outside</div>
        </div>
      );

      // Enter edit mode
      const editButton = screen.getByTitle("Edit demo name");
      await user.click(editButton);

      // Type new name
      const input = screen.getByDisplayValue("Test Demo");
      await user.clear(input);
      await user.type(input, "New Demo Name");

      // Click outside
      const outsideElement = screen.getByTestId("outside-element");
      await user.click(outsideElement);

      // Should not save
      expect(mockOnChangeName).not.toHaveBeenCalled();
      expect(mockOnSaveTitle).not.toHaveBeenCalled();

      // Should exit edit mode and show original title
      await waitFor(() => {
        expect(screen.getByText("Test Demo")).toBeInTheDocument();
        expect(screen.queryByDisplayValue("New Demo Name")).not.toBeInTheDocument();
      });
    });

    it("saves empty input as 'Untitled Demo'", async () => {
      const user = userEvent.setup();
      const mockOnChangeName = vi.fn();
      const mockOnSaveTitle = vi.fn().mockResolvedValue(undefined);

      render(<EditorHeader {...defaultProps} onChangeName={mockOnChangeName} onSaveTitle={mockOnSaveTitle} />);

      // Enter edit mode
      const editButton = screen.getByTitle("Edit demo name");
      await user.click(editButton);

      // Clear input and save
      const input = screen.getByDisplayValue("Test Demo");
      await user.clear(input);

      const saveButton = screen.getByTestId("title-save-button");
      await user.click(saveButton);

      expect(mockOnChangeName).toHaveBeenCalledWith("Untitled Demo");
      expect(mockOnSaveTitle).toHaveBeenCalledWith("Untitled Demo");
    });

    it("trims whitespace from input", async () => {
      const user = userEvent.setup();
      const mockOnChangeName = vi.fn();
      const mockOnSaveTitle = vi.fn().mockResolvedValue(undefined);

      render(<EditorHeader {...defaultProps} onChangeName={mockOnChangeName} onSaveTitle={mockOnSaveTitle} />);

      // Enter edit mode
      const editButton = screen.getByTitle("Edit demo name");
      await user.click(editButton);

      // Type name with whitespace
      const input = screen.getByDisplayValue("Test Demo");
      await user.clear(input);
      await user.type(input, "  Spaced Name  ");

      const saveButton = screen.getByTestId("title-save-button");
      await user.click(saveButton);

      expect(mockOnChangeName).toHaveBeenCalledWith("Spaced Name");
      expect(mockOnSaveTitle).toHaveBeenCalledWith("Spaced Name");
    });

    it("shows saving state on save button", () => {
      render(<EditorHeader {...defaultProps} savingTitle={true} />);

      // Enter edit mode first
      const editButton = screen.getByTitle("Edit demo name");
      fireEvent.click(editButton);

      expect(screen.getByText("Saving...")).toBeInTheDocument();
    });

    it("disables save button when saving", () => {
      render(<EditorHeader {...defaultProps} savingTitle={true} />);

      // Enter edit mode first
      const editButton = screen.getByTitle("Edit demo name");
      fireEvent.click(editButton);

      const saveButton = screen.getByTestId("title-save-button");
      expect(saveButton).toBeDisabled();
    });

    it("does not show edit icon when no demoId", () => {
      render(<EditorHeader {...defaultProps} demoId={undefined} />);

      expect(screen.queryByTitle("Edit demo name")).not.toBeInTheDocument();
    });
  });

  describe("Button Visibility by Status", () => {
    it("shows Copy button for published demos", () => {
      render(<EditorHeader {...defaultProps} demoStatus="PUBLISHED" onOpenShareDialog={vi.fn()} />);

      expect(screen.getByTestId("share-button")).toBeInTheDocument();
      expect(screen.getByText("Copy")).toBeInTheDocument();
    });

    it("shows Publish button for draft demos with demoId", () => {
      render(<EditorHeader {...defaultProps} demoStatus="DRAFT" />);

      expect(screen.getByTestId("publish-button")).toBeInTheDocument();
      expect(screen.getByText("Publish")).toBeInTheDocument();
    });

    it("shows Preview button for unsaved demos (no demoId)", () => {
      render(<EditorHeader {...defaultProps} demoId={undefined} demoStatus="DRAFT" />);

      expect(screen.getByTestId("preview-button")).toBeInTheDocument();
      expect(screen.getByText("Preview")).toBeInTheDocument();
    });

    it("shows Preview in dropdown for draft demos with demoId", async () => {
      const user = userEvent.setup();
      render(<EditorHeader {...defaultProps} demoStatus="DRAFT" />);

      // Open dropdown menu
      const dropdownBtn = screen.getByTestId("actions-menu");
      await user.click(dropdownBtn);

      expect(screen.getByText("Preview")).toBeInTheDocument();
    });

    it("shows Unpublish in dropdown for published demos", async () => {
      const user = userEvent.setup();
      render(<EditorHeader {...defaultProps} demoStatus="PUBLISHED" />);

      // Open dropdown menu
      const dropdownBtn = screen.getByTestId("actions-menu");
      await user.click(dropdownBtn);

      expect(screen.getByText("Unpublish")).toBeInTheDocument();
    });
  });

  describe("Button Layout", () => {
    it("shows Publish button before Save button for draft with demoId", () => {
      render(<EditorHeader {...defaultProps} demoStatus="DRAFT" />);

      const publishButton = screen.getByTestId("publish-button");
      const mainSaveButton = screen.getByTestId("main-save-button");

      expect(publishButton).toBeInTheDocument();
      expect(mainSaveButton).toBeInTheDocument();

      const position = publishButton.compareDocumentPosition(mainSaveButton);
      expect(position & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });

    it("shows dropdown menu when demoId exists", () => {
      render(<EditorHeader {...defaultProps} />);

      expect(screen.getByTestId("actions-menu")).toBeInTheDocument();
    });

    it("hides dropdown menu when no demoId", () => {
      render(<EditorHeader {...defaultProps} demoId={undefined} />);

      expect(screen.queryByTestId("actions-menu")).not.toBeInTheDocument();
    });
  });

  describe("Preview Mode", () => {
    it("shows preview navigation when isPreviewing is true", () => {
      render(<EditorHeader {...defaultProps} isPreviewing={true} />);

      expect(screen.getByText("Prev")).toBeInTheDocument();
      expect(screen.getByText("Next")).toBeInTheDocument();
    });

    it("hides preview navigation when isPreviewing is false", () => {
      render(<EditorHeader {...defaultProps} isPreviewing={false} />);

      expect(screen.queryByText("Prev")).not.toBeInTheDocument();
      expect(screen.queryByText("Next")).not.toBeInTheDocument();
    });
  });
});
