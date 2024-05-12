import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it , vi } from "vitest";
import { EditGroupName } from "./EditGroupName";
import { Group } from "@src/pages/models/Group";

vi.mock("@src/pages/background/storage");

describe("EditGroupName", () => {

  const group = {
    groupName: "group name"
  } as Group;

  const allGroups = [group, { groupName: "group name 2"}] as Group[];

  it("should render group name and one button", () => {
    render(<EditGroupName allGroups={allGroups} group={group}/>);
    expect(screen.getByText("group name")).toBeInTheDocument();
    expect(screen.getByRole("button")).toBeInTheDocument();
  });

  it("should render group name and form when button is clicked", () => {
    render(<EditGroupName allGroups={allGroups} group={group}/>);
    fireEvent.click(screen.getByRole("button"));
    expect((screen.getByLabelText('Group Name') as HTMLInputElement).value).toBe("group name");
  });

  it("should hide form when submit button is clicked", () => {
    render(<EditGroupName allGroups={allGroups} group={group}/>);
    fireEvent.click(screen.getByRole("button"));
    fireEvent.click(screen.getByRole("button"));
    expect(screen.getByText("group name")).toBeInTheDocument();
    expect(screen.getByRole("button")).toBeInTheDocument();
    let formLabel = undefined;
    try {
      formLabel = screen.getByLabelText('Group Name');
    } catch (e) {
      expect(formLabel).toBeUndefined();
    }
  });

  it("should show 'Update Name' placeholder in input field when form input value is cleared/empty", async () => {
    render(<EditGroupName allGroups={allGroups} group={group}/>);
    fireEvent.click(screen.getByRole("button"));
    fireEvent.change(screen.getByLabelText('Group Name'), { target: { value: "" } });
    const placeholder = await screen.queryByPlaceholderText(/Updated Name/i);
    expect(placeholder?.getAttribute("placeholder")).toBe("Updated Name");
  });

  it("should update group name when submit button is clicked", async () => {
    render(<EditGroupName allGroups={allGroups} group={group}/>);
    const setLocalStorageMock = await import("@src/pages/background/storage");
    fireEvent.click(screen.getByRole("button"));
    fireEvent.change(screen.getByLabelText('Group Name'), { target: { value: "new group name" } });
    fireEvent.click(screen.getByRole("button"));
    expect(screen.getByText("new group name")).toBeInTheDocument();
    expect(setLocalStorageMock.setLocalStorage).toHaveBeenCalledWith("betterTwitchSidebar", allGroups);
  });
});
