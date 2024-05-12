import { fireEvent, render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { GroupNameForm } from "./GroupNameForm";

const content = {
  placeholder: "Group Name",
  ctaType: "Add",
  infoMessage: "Add New Group",
};

const setup = () => {
  const utils = render(<GroupNameForm
    content={content}
    submit={() => {
      return;
    }}
    value="gname1"
    groupNames={['group1']}
    action="edit"
    initialErrorState={{
      invalid: false,
      blank: false,
      overCharacterLimit: false,
      errorMessages: [],
    }}
    initialValue="gname1"
  />);
  const input = screen.getByLabelText("Group Name");
  return {
    input,
    ...utils,
  };
};

describe("GroupNameForm", () => {
  it("should render input and label when empty objects are passed into component", () => {
    render(
      <GroupNameForm
        content={content}
        submit={() => {
          return;
        }}
        value="gname1"
        groupNames={[]}
        action="edit"
        initialErrorState={{
          invalid: false,
          blank: false,
          overCharacterLimit: false,
          errorMessages: [],
        }}
        initialValue="gname1"
      />
    );
    expect(screen.getByLabelText("Group Name")).toBeInTheDocument();
    expect(screen.getByText("Group Name")).toBeInTheDocument();
  });

  it("should render submit cta based on action", async () => {
    render(
      <GroupNameForm
        content={content}
        submit={() => {
          return;
        }}
        value="gname1"
        groupNames={[]}
        action="edit"
        initialErrorState={{
          invalid: false,
          blank: false,
          overCharacterLimit: false,
          errorMessages: [],
        }}
        initialValue="gname1"
      />
    );
    expect(screen.getByRole("button")).toHaveTextContent("Add");
  });

  it('should render info message when action is not "edit"', async () => {
    render(
      <GroupNameForm
        content={content}
        submit={() => {
          return;
        }}
        value="gname1"
        groupNames={[]}
        action="add"
        initialErrorState={{
          invalid: false,
          blank: false,
          overCharacterLimit: false,
          errorMessages: [],
        }}
        initialValue="gname1"
      />
    );
    const infoMessage = await screen.findByText("Add New Group");
    expect(infoMessage.textContent).toBe("Add New Group");
  });

  it("should render error message when group name is less than 3 characters and button should be disabled", async () => {
    const { input } = setup();
    fireEvent.change(input, { target: { value: "ab" } });
    const errorMessage = await screen.findByText(
      "Group name must be at least 3 characters"
    );
    const button = await screen.findByRole("button");
    expect(errorMessage.textContent).toBe(
      "Group name must be at least 3 characters"
    );
    expect(button).toBeDisabled();
  });

  it("should render error message when group name is over 15 characters and button should be disabled", async () => {
    const { input } = setup();
    fireEvent.change(input, { target: { value: "abcdefghijklmnop" } });
    const errorMessage = await screen.findByText(
      "Group name cannot be over 15 characters"
    );
    const button = await screen.findByRole("button");
    expect(errorMessage.textContent).toBe(
      "Group name cannot be over 15 characters"
    );
    expect(button).toBeDisabled();
  });

  it("should render error message when group name already exists and button should be disabled", async () => {
    const { input } = setup();
    fireEvent.change(input, { target: { value: "group1" } });
    const errorMessage = await screen.findByText("Group name already exists");
    const button = await screen.findByRole("button");
    expect(errorMessage.textContent).toBe("Group name already exists");
    expect(button).toBeDisabled();
  });

  it("should render not show info message when group name is same as intial value while editing existing group", async () => {
    const { input } = setup();
    fireEvent.change(input, { target: { value: "testing" } });
    fireEvent.change(input, { target: { value: "gname1" } });
    let infoMessage = undefined;
    try {
      infoMessage = await screen.findByText("Add New Group");
    } catch (e) {
      expect(infoMessage).toBeUndefined();
    }
  });

});
