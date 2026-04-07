import React, { useCallback, useEffect, useMemo, useState } from "react";
import { z } from "zod";

export type TaskFormValues = {
  id?: string;
  title: string;
  description?: string | null;
  dueDate?: string | null; // ISO date string (YYYY-MM-DD) or null
};

type TaskFormMode = "create" | "edit";

type TaskFormProps = {
  mode?: TaskFormMode;
  initialValues?: TaskFormValues;
  onSuccess?: (task: TaskFormValues) => void;
  onCancel?: () => void;
};

const taskSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "Title is required")
    .max(255, "Title must be at most 255 characters"),
  description: z
    .string()
    .trim()
    .max(2000, "Description must be at most 2000 characters")
    .optional()
    .or(z.literal("")),
  dueDate: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Due date must be a valid date")
    .optional()
    .or(z.literal("")),
});

type TaskFormErrors = {
  title?: string;
  description?: string;
  dueDate?: string;
  form?: string;
};

const normalizeInitialValues = (values?: TaskFormValues): TaskFormValues => {
  if (!values) {
    return {
      title: "",
      description: "",
      dueDate: "",
    };
  }

  return {
    id: values.id,
    title: values.title ?? "",
    description: values.description ?? "",
    dueDate: values.dueDate ?? "",
  };
};

const TaskForm: React.FC<TaskFormProps> = ({
  mode = "create",
  initialValues,
  onSuccess,
  onCancel,
}) => {
  const [values, setValues] = useState<TaskFormValues>(() =>
    normalizeInitialValues(initialValues)
  );
  const [errors, setErrors] = useState<TaskFormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasSubmittedOnce, setHasSubmittedOnce] = useState(false);

  const isEditMode = useMemo(() => mode === "edit", [mode]);

  useEffect(() => {
    setValues(normalizeInitialValues(initialValues));
    setErrors({});
    setHasSubmittedOnce(false);
  }, [initialValues]);

  const validateField = useCallback(
    (fieldName: keyof TaskFormValues, value: string | undefined | null) => {
      try {
        const partial = { ...values, [fieldName]: value ?? "" };
        const parsed = taskSchema.parse({
          title: partial.title,
          description: partial.description ?? "",
          dueDate: partial.dueDate ?? "",
        });
        const newErrors: TaskFormErrors = { ...errors };
        delete newErrors[fieldName];
        setErrors(newErrors);
        return { success: true, data: parsed };
      } catch (err) {
        if (err instanceof z.ZodError) {
          const fieldError = err.errors.find(
            (e) => e.path[0] === fieldName
          )?.message;
          if (fieldError) {
            setErrors((prev) => ({
              ...prev,
              [fieldName]: fieldError,
            }));
          } else {
            setErrors((prev) => {
              const updated = { ...prev };
              delete updated[fieldName];
              return updated;
            });
          }
        }
        return { success: false };
      }
    },
    [errors, values]
  );

  const validateForm = useCallback(
    (currentValues: TaskFormValues) => {
      try {
        const parsed = taskSchema.parse({
          title: currentValues.title,
          description: currentValues.description ?? "",
          dueDate: currentValues.dueDate ?? "",
        });
        setErrors({});
        return { success: true, data: parsed };
      } catch (err) {
        if (err instanceof z.ZodError) {
          const fieldErrors: TaskFormErrors = {};
          for (const issue of err.errors) {
            const key = issue.path[0] as keyof TaskFormErrors;
            if (!fieldErrors[key]) {
              fieldErrors[key] = issue.message;
            }
          }
          setErrors(fieldErrors);
        } else {
          setErrors({ form: "An unexpected validation error occurred." });
        }
        return { success: false };
      }
    },
    []
  );

  const handleChange =
    (field: keyof TaskFormValues) =>
    (
      event:
        | React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
        | React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>
    ) => {
      const value =
        event.type === "blur"
          ? (event.target as HTMLInputElement | HTMLTextAreaElement).value.trim()
          : (event.target as HTMLInputElement | HTMLTextAreaElement).value;

      setValues((prev) => ({
        ...prev,
        [field]: value,
      }));

      if (hasSubmittedOnce || event.type === "blur") {
        validateField(field, value);
      }
    };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (isSubmitting) return;

    setHasSubmittedOnce(true);
    setErrors((prev) => ({ ...prev, form: undefined }));

    const validation = validateForm(values);
    if (!validation.success) {
      return;
    }

    const payload: TaskFormValues = {
      id: values.id,
      title: validation.data.title,
      description:
        validation.data.description && validation.data.description.length > 0
          ? validation.data.description
          : null,
      dueDate:
        validation.data.dueDate && validation.data.dueDate.length > 0
          ? validation.data.dueDate
          : null,
    };

    setIsSubmitting(true);

    try {
      const endpoint =
        isEditMode && payload.id
          ? `/api/tasks/undefined`
          : "/api/tasks";
      const method = isEditMode && payload.id ? "PUT" : "POST";

      const response = await fetch(endpoint, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        let message = "Failed to save task.";
        try {
          const data = await response.json();
          if (typeof data?.error === "string") {
            message = data.error;
          } else if (typeof data?.message === "string") {
            message = data.message;
          }
        } catch {
          // ignore JSON parse errors
        }
        setErrors((prev) => ({
          ...prev,
          form: message,
        }));
        return;
      }

      const result = (await response.json()) as TaskFormValues;
      if (onSuccess) {
        onSuccess(result);
      } else if (!isEditMode) {
        // Reset form in create mode if no onSuccess handler
        setValues(normalizeInitialValues());
        setHasSubmittedOnce(false);
        setErrors({});
      }
    } catch (error) {
      setErrors((prev) => ({
        ...prev,
        form: "Network error while saving task. Please try again.",
      }));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} noValidate>
      {errors.form && (
        <div
          role="alert"
          aria-live="assertive"
          style={{ color: "red", marginBottom: "0.75rem" }}
        >
          {errors.form}
        </div>
      )}

      <div style={{ marginBottom: "0.75rem" }}>
        <label
          htmlFor="task-title"
          style={{ display: "block", fontWeight: 600, marginBottom: "0.25rem" }}
        >
          Title<span style={{ color: "red" }}> *</span>
        </label>
        <input
          id="task-title"
          name="title"
          type="text"
          value={values.title}
          onChange={handleChange("title")}
          onBlur={handleChange("title")}
          required
          maxLength={255}
          aria-invalid={!!errors.title}
          aria-describedby={errors.title ? "task-title-error" : undefined}
          style={{
            width: "100%",
            padding: "0.5rem",
            borderRadius: 4,
            border: errors.title ? "1px solid red" : "1px solid #ccc",
            boxSizing: "border-box",
          }}
        />
        {errors.title && (
          <div
            id="task-title-error"
            style={{ color: "red", fontSize: "0.875rem", marginTop: "0.25rem" }}
          >
            {errors.title}
          </div>
        )}
      </div>

      <div style={{ marginBottom: "0.75rem" }}>
        <label
          htmlFor="task-description"
          style={{ display: "block", fontWeight: 600, marginBottom: "0.25rem" }}
        >
          Description
        </label>
        <textarea
          id="task-description"
          name="description"