import { ChangeEvent, FormEvent, useEffect, useState } from "react";
import { ErrorState } from "../add-group-form/AddGroupModels";
import { CheckCircleIcon } from "@heroicons/react/24/outline";

export const GroupNameForm = ({
  content,
  submit,
  value,
  groupNames,
  action,
  initialErrorState,
  initialValue
}: {
  content: {
    placeholder: string;
    ctaType: string;
    infoMessage: string;
  };
  submit: (groupName: string) => void;
  groupNames: string[];
  action: string;
  initialErrorState: ErrorState;
  value?: string;
  initialValue?: string;
}) => {
  const [errors, setErrors] = useState<ErrorState>(initialErrorState);
  const [showInfoMessage, setShowInfoMessage] = useState(true);
  const [formValue, setFormValue] = useState(value ?? "");

  useEffect(() => {
    if(action === "edit" && initialValue === value) {
      setShowInfoMessage(false);
    } else {
      setShowInfoMessage(true);
    }
  }, [showInfoMessage]);

  const handleInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    const groupName = event.target.value;
    if(action === "edit" && initialValue === groupName) {
      setErrors({
        ...errors,
        invalid: false,
        blank: false,
        errorMessages: [],
      });
      setShowInfoMessage(false);
    } else if (groupName.length === 0) {
      setErrors({
        ...errors,
        invalid: true,
        blank: true,
        errorMessages: ["Group name cannot be blank"],
      });
    } else if (groupName.length > 15) {
      setErrors({
        ...errors,
        invalid: true,
        blank: false,
        overCharacterLimit: true,
        errorMessages: ["Group name cannot be over 15 characters"],
      });
    } else if (groupNames.includes(groupName.toLowerCase())) {
      setErrors({
        ...errors,
        invalid: true,
        blank: false,
        errorMessages: ["Group name already exists"],
      });
    } else if (groupName.length < 3) {
      setErrors({
        ...errors,
        invalid: true,
        blank: false,
        errorMessages: ["Group name must be at least 3 characters"],
      });
    } else {
      setErrors({ ...errors, invalid: false, blank: false, errorMessages: [] });
      setShowInfoMessage(true);
    }
    setFormValue(groupName);
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    submit(formValue);
    if(action === "add") {
      setFormValue("");
      setErrors({
        ...errors,
        invalid: true,
        blank: true,
        errorMessages: ["Group name cannot be blank"],
      });
    }
  }

  return (
    <div className="justify-self-end">
      <form
        className="w-full max-w-sm border-2 border-rose-500"
        onSubmit={handleSubmit}
      >
        <div className="flex items-center py-2 mr-2">
          <div className="items-start">
            <label
              className="block text-gray-700 text-sm font-bold mb-2"
              htmlFor="add-group-input"
            >
              Group Name
            </label>
            <input
              id="add-group-input"
              className={
                "shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 mb-3 leading-tight focus:outline-none focus:shadow-outline " +
                (errors.invalid ? "border-red-500" : "")
              }
              type="text"
              placeholder={content.placeholder}
              value={formValue}
              onChange={handleInputChange}
            />
            {errors.errorMessages.map((error: string) => (
              <p key={error} className="text-red-500 text-sm italic">
                {error}
              </p>
            ))}
            {(!errors.invalid && showInfoMessage) && (
              <p className="text-purple-500 text-sm italic">{content.infoMessage}</p>
            )}
          </div>
          {
            {
              "Add": (
                <button
                  disabled={errors.invalid}
                  className="rounded relative inline-flex group items-center justify-center px-3.5 py-2 m-1 cursor-pointer border-b-4 border-l-2 active:border-purple-600 active:shadow-none shadow-lg bg-purple-500 border-purple-700 text-white disabled:bg-gray-500 disabled:cursor-not-allowed disabled:hover:bg-gray-500"
                  type="submit"
                >
                  <span className="absolute w-0 h-0 transition-all duration-300 ease-out bg-white rounded-full group-hover:w-32 group-hover:h-32 opacity-10"></span>
                  <span className="relative">Add</span>
                </button>
              ),
              "Edit": (
                <button
                  disabled={errors.invalid}
                  type="submit"
                  className="rounded hover:bg-slate-200 ml-16 disabled:hover:bg-slate-500 disabled:cursor-not-allowed"
                >
                  <CheckCircleIcon className="w-8 h-8 text-black"></CheckCircleIcon>
                </button>
              ),
            }[content.ctaType]
          }
        </div>
      </form>
    </div>
  );
};
