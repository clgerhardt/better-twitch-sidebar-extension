import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import AddGroup from "./AddGroup";

const defaultGroups: string[] = ["group1", "group2", "group3"];

const setup = (groups: string[] = defaultGroups) => {
  const updateFollowersListSpy = vi.fn();
  const utils = render(
    <AddGroup groups={groups} updateFollowersList={updateFollowersListSpy} />
  );
  const input = screen.getByLabelText("Group Name");
  return {
    input,
    updateFollowersListSpy,
    ...utils,
  };
};

describe("AddGroup", () => {
  it("should render initial elements, button disabled and form invalid for being blank", async () => {
    render(
      <AddGroup
        groups={defaultGroups}
        updateFollowersList={() => {
          return;
        }}
      />
    );

    const label = await screen.findByText("Group Name");
    const placeholder = await screen.queryByPlaceholderText(/New Group/i);
    const button = await screen.findByRole("button");
    const errorMessage = await screen.findByText("Group name cannot be blank");

    expect(label.textContent).toBe("Group Name");
    expect(placeholder?.getAttribute("placeholder")).toBe("New Group");
    expect(button).toBeDisabled();
    expect(errorMessage.textContent).toBe("Group name cannot be blank");
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

  it("should render error message when group name is blank after deleting previously typed text and button should be disabled", async () => {
    const { input } = setup();
    fireEvent.change(input, { target: { value: "test-new-group" } });
    fireEvent.change(input, { target: { value: "" } });
    const errorMessage = await screen.findByText("Group name cannot be blank");
    const button = await screen.findByRole("button");
    expect(errorMessage.textContent).toBe("Group name cannot be blank");
    expect(button).toBeDisabled();
  });

  it("should render success message when group name is valid and button should be enabled", async () => {
    const { input } = setup();
    fireEvent.change(input, { target: { value: "newGroup" } });
    const successMessage = await screen.findByText("Add your group!");
    const button = await screen.findByRole("button");
    expect(successMessage.textContent).toBe("Add your group!");
    expect(button).not.toBeDisabled();
  });

  it("should call updateFollowersList when form is submitted", async () => {
    const { input, updateFollowersListSpy } = setup();
    fireEvent.change(input, { target: { value: "newGroup" } });
    const button = await screen.findByRole("button");
    fireEvent.click(button);
    expect(updateFollowersListSpy).toHaveBeenCalledWith({
      default: false,
      dialogOpen: false,
      dropdownVisible: false,
      followedChannels: [],
      groupName: "newGroup",
      numberOfChannels: 0,
      numberOfLiveChannels: 0,
      order: 3,
    });
  });
});
