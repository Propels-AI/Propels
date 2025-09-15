"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface DeleteDemoModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  demoName: string;
}

export function DeleteDemoModal({ isOpen, onClose, onConfirm, demoName }: DeleteDemoModalProps) {
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await onConfirm();
      onClose();
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(nextOpen) => {
        if (!nextOpen && !isDeleting) {
          onClose();
        }
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="space-y-4">
          <DialogTitle className="text-xl font-medium text-foreground">Delete Demo</DialogTitle>
          <DialogDescription className="text-left space-y-4 text-muted-foreground">
            <p>Are you sure you want to delete this demo? This action cannot be undone.</p>

            <div className="py-3 px-4 bg-muted/50 rounded-lg border">
              <p className="text-sm">
                Demo: <span className="font-medium text-foreground">{demoName}</span>
              </p>
            </div>

            <p className="text-sm text-muted-foreground">
              <span className="font-medium">Note:</span> Lead submissions will be preserved and can still be accessed
              from the leads page.
            </p>
          </DialogDescription>
        </DialogHeader>

        <DialogFooter className="flex gap-3 pt-2">
          <Button variant="outline" onClick={onClose} disabled={isDeleting} className="flex-1 bg-transparent">
            Cancel
          </Button>
          <Button variant="destructive" onClick={handleDelete} disabled={isDeleting} className="flex-1">
            {isDeleting ? "Deleting..." : "Delete Demo"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
