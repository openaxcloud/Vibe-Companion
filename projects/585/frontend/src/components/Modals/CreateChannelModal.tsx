import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  IconButton,
  Typography,
  FormControlLabel,
  Switch,
  Box,
  Chip,
  Avatar,
  CircularProgress,
  InputAdornment,
  List,
  ListItemButton,
  ListItemAvatar,
  ListItemText,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import SearchIcon from "@mui/icons-material/Search";
import CheckIcon from "@mui/icons-material/Check";

type User = {
  id: string;
  name: string;
  email?: string;
  avatarUrl?: string | null;
};

type CreateChannelPayload = {
  name: string;
  isPrivate: boolean;
  memberIds: string[];
};

type CreateChannelModalProps = {
  open: boolean;
  onClose: () => void;
  onCreateChannel: (payload: CreateChannelPayload) => Promise<void> | void;
  /**
   * Preloaded users to select from. If null/undefined, onSearchUsers MUST be provided.
   */
  users?: User[];
  /**
   * Called when searching for users. Should return a list of users matching query.
   */
  onSearchUsers?: (query: string) => Promise<User[]>;
  /**
   * Optional title override.
   */
  title?: string;
  /**
   * Optional flag that, if true, disables changing privacy and forces private channel.
   */
  forcePrivate?: boolean;
  /**
   * Optional initial state for isPrivate.
   */
  defaultPrivate?: boolean;
  /**
   * Optional callback when modal is opened. Useful for prefetching.
   */
  onOpen?: () => void;
};

const MIN_CHANNEL_NAME_LENGTH = 3;
const MAX_CHANNEL_NAME_LENGTH = 50;

const CreateChannelModal: React.FC<CreateChannelModalProps> = ({
  open,
  onClose,
  onCreateChannel,
  users,
  onSearchUsers,
  title,
  forcePrivate = false,
  defaultPrivate = false,
  onOpen,
}) => {
  const [channelName, setChannelName] = useState<string>("");
  const [isPrivate, setIsPrivate] = useState<boolean>(defaultPrivate || forcePrivate);
  const [selectedMembers, setSelectedMembers] = useState<User[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [nameError, setNameError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setChannelName("");
      setIsPrivate(defaultPrivate || forcePrivate);
      setSelectedMembers([]);
      setSearchQuery("");
      setSearchResults([]);
      setNameError(null);
      setSubmitError(null);
      if (onOpen) onOpen();
      if (users && users.length > 0) {
        setSearchResults(users);
      }
    }
  }, [open, users, forcePrivate, defaultPrivate, onOpen]);

  useEffect(() => {
    let active = true;
    const performSearch = async () => {
      if (!onSearchUsers) {
        if (users) {
          const query = searchQuery.trim().toLowerCase();
          const filtered = users.filter((u) => {
            if (!query) return true;
            const target = `undefined undefined`.toLowerCase();
            return target.includes(query);
          });
          if (active) setSearchResults(filtered);
        }
        return;
      }

      const query = searchQuery.trim();
      if (!query) {
        setSearchResults(users ?? []);
        return;
      }

      setIsSearching(true);
      try {
        const result = await onSearchUsers(query);
        if (active) {
          setSearchResults(result);
        }
      } catch {
        if (active) {
          // In production, you might log this error
          setSearchResults([]);
        }
      } finally {
        if (active) setIsSearching(false);
      }
    };

    performSearch();

    return () => {
      active = false;
    };
  }, [searchQuery, onSearchUsers, users]);

  const handleClose = useCallback(() => {
    if (isSubmitting) return;
    onClose();
  }, [isSubmitting, onClose]);

  const handleToggleMember = useCallback(
    (user: User) => {
      setSelectedMembers((prev) => {
        const exists = prev.some((m) => m.id === user.id);
        if (exists) {
          return prev.filter((m) => m.id !== user.id);
        }
        return [...prev, user];
      });
    },
    [setSelectedMembers]
  );

  const handleRemoveMemberChip = useCallback(
    (userId: string) => {
      setSelectedMembers((prev) => prev.filter((m) => m.id !== userId));
    },
    [setSelectedMembers]
  );

  const validateName = useCallback((value: string): string | null => {
    const trimmed = value.trim();
    if (!trimmed) return "Channel name is required";
    if (trimmed.length < MIN_CHANNEL_NAME_LENGTH) {
      return `Channel name must be at least undefined characters`;
    }
    if (trimmed.length > MAX_CHANNEL_NAME_LENGTH) {
      return `Channel name must be at most undefined characters`;
    }
    if (!/^[a-zA-Z0-9-_ ]+$/.test(trimmed)) {
      return "Channel name can only contain letters, numbers, spaces, hyphens and underscores";
    }
    return null;
  }, []);

  const handleNameChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const value = event.target.value;
      setChannelName(value);
      setNameError(null);
      if (submitError) setSubmitError(null);
    },
    [submitError]
  );

  const handlePrivateToggle = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      if (forcePrivate) return;
      setIsPrivate(event.target.checked);
    },
    [forcePrivate]
  );

  const handleSearchChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(event.target.value);
  }, []);

  const handleSubmit = useCallback(
    async (event: React.FormEvent) => {
      event.preventDefault();
      if (isSubmitting) return;
      const error = validateName(channelName);
      if (error) {
        setNameError(error);
        return;
      }

      setIsSubmitting(true);
      setSubmitError(null);

      const payload: CreateChannelPayload = {
        name: channelName.trim(),
        isPrivate,
        memberIds: selectedMembers.map((m) => m.id),
      };

      try {
        const maybePromise = onCreateChannel(payload);
        if (maybePromise && typeof (maybePromise as Promise<void>).then === "function") {
          await maybePromise;
        }
        onClose();
      } catch (err: unknown) {
        let message = "Failed to create channel. Please try again.";
        if (err instanceof Error && err.message) {
          message = err.message;
        }
        setSubmitError(message);
      } finally {
        setIsSubmitting(false);
      }
    },
    [channelName, isPrivate, selectedMembers, isSubmitting, onCreateChannel, onClose, validateName]
  );

  const isSubmitDisabled = useMemo(() => {
    if (isSubmitting) return true;
    const hasError = !!validateName(channelName);
    return hasError;
  }, [channelName, isSubmitting, validateName]);

  const renderUserAvatar = (user: User) => {
    if (user.avatarUrl) {
      return <Avatar src={user.avatarUrl} alt={user.name} />;
    }
    const initials =
      user.name
        ?.split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase() ?? "?";
    return <Avatar>{initials}</Avatar>;
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      fullWidth
      maxWidth="sm"
      aria-labelledby="create-channel-dialog-title"
    >
      <form onSubmit={handleSubmit} noValidate>
        <DialogTitle
          id="create-channel-dialog-title"
          sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", pr: 1 }}
        >
          <Typography variant="h6">
            {title || "Create Channel"}
          </Typography>
          <IconButton
            aria-label="Close"
            onClick={handleClose}
            size="small"
            disabled={isSubmitting}
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers>
          <Box display="flex" flexDirection="column" gap={2}>
            <TextField
              autoFocus
              fullWidth
              label="Channel name"
              value={channelName}
              onChange={