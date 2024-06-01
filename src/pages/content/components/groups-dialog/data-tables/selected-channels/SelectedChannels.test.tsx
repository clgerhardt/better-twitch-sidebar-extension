import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SelectedChannels } from "./SelectedChannels";
import userEvent from '@testing-library/user-event'
import { constants } from "@src/pages/utils/constants";
import exp from "constants";

vi.mock("@src/pages/background/storage");

describe("SelectedChannels", () => {
  it("should render selected channels text", () => {
    render(
      <SelectedChannels
        selectedCount="1"
        selectedRows={[]}
        currentGroup="group1"
        groups={[]}
        groupNames={["group1"]}
        setToggleCleared={() => {
          return;
        }}
        setSelectedRows={() => {
          return;
        }}
      />
    );

    const button = screen.getByRole("button");
    expect(screen.getByText("Selected Channels: 1")).toBeInTheDocument();
    expect(screen.getByText("Select an option")).toBeInTheDocument();
    expect((screen.getByRole('option', { name: 'Choose a group' }) as HTMLOptionElement).selected).toBe(true);
    expect(button).toBeInTheDocument();
    expect(button).toHaveTextContent("Move");
    expect(button).toBeDisabled();
  });

  it("should enable button when a group is selected", async () => {
    render(
      <SelectedChannels
        selectedCount="1"
        selectedRows={[]}
        currentGroup="group1"
        groups={[]}
        groupNames={["group1", "group2"]}
        setToggleCleared={() => {
          return;
        }}
        setSelectedRows={() => {
          return;
        }}
      />
    );
    await userEvent.selectOptions(
      screen.getByRole('combobox'),
      "group1"
    )
    expect((screen.getByRole('option', { name: 'group1' }) as HTMLOptionElement).selected).toBe(true);
  });

  it("should call setToggleCleared, setSelectedRows and setLocalStorage when button is clicked", async () => {
    const setToggleClearedSpy = vi.fn();
    const setSelectedRowsSpy = vi.fn();
    const setLocalStorageMock = await import("@src/pages/background/storage");
    render(
      <SelectedChannels
        selectedCount="1"
        selectedRows={[]}
        currentGroup="group1"
        groups={[]}
        groupNames={["group1", "group2"]}
        setToggleCleared={setToggleClearedSpy}
        setSelectedRows={
          setSelectedRowsSpy
        }
      />
    );
    await userEvent.selectOptions(
      screen.getByRole('combobox'),
      "group1"
    )

    const button = screen.getByRole("button");
    fireEvent.click(button);
    expect(setToggleClearedSpy).toHaveBeenCalledWith(true);
    expect(setSelectedRowsSpy).toHaveBeenCalledWith([]);
    expect(setLocalStorageMock.setLocalStorage).toHaveBeenCalledWith(constants.storage.localStorageKey, []);
  });
});
