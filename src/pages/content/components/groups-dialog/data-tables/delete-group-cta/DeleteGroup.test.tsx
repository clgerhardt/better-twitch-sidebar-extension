import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import DeleteGroup from "./DeleteGroup";

vi.mock("@src/pages/background/storage");

const groupsMock = [
  {
    groupName: "group1",
    numberOfChannels: 1,
    order: 0,
    dialogOpen: false,
    default: true,
    dropdownVisible: false,
    numberOfLiveChannels: 0,
    followedChannels: [
      {
        channelImage:
          "https://static-cdn.jtvnw.net/jtv_user_pictures/49182eb9-e05e-401e-bee1-478e59d61fe9-profile_image-70x70.png",
        channelLink: "https://twitch.tv/mande",
        channelName: "Mande",
        expandedHTML:
          '<div class="Layout-sc-1xcs6mc-0 bgXDR side-nav-card__avatar"><div class="ScAvatar-sc-144b42z-0 dmnDPS tw-avatar"><img class="InjectLayout-sc-1i43xsx-0 cXFDOs tw-image tw-image-avatar" alt="Mande" src="https://static-cdn.jtvnw.net/jtv_user_pictures/49182eb9-e05e-401e-bee1-478e59d61fe9-profile_image-70x70.png"></div></div><div class="Layout-sc-1xcs6mc-0 eza-dez"><div class="Layout-sc-1xcs6mc-0 iULZCz"><div data-a-target="side-nav-card-metadata" class="Layout-sc-1xcs6mc-0 cxkdpa"><div class="Layout-sc-1xcs6mc-0 xxjeD side-nav-card__title"><p title="Mande" data-a-target="side-nav-title" class="CoreText-sc-1txzju1-0 fdYGpZ HcPqQ InjectLayout-sc-1i43xsx-0">Mande</p></div><div class="Layout-sc-1xcs6mc-0 bYeGkU side-nav-card__metadata" data-a-target="side-nav-game-title"><p title="Apex Legends" class="CoreText-sc-1txzju1-0 eUABfN">Apex Legends</p></div></div><div class="Layout-sc-1xcs6mc-0 fCKtYt side-nav-card__live-status" data-a-target="side-nav-live-status"><div class="Layout-sc-1xcs6mc-0 xxjeD"><div class="ScChannelStatusIndicator-sc-bjn067-0 kqWDUJ tw-channel-status-indicator"></div><p class="CoreText-sc-1txzju1-0 InjectLayout-sc-1i43xsx-0 cmeMuc">Live</p><div class="Layout-sc-1xcs6mc-0 jOVwMQ"><span aria-hidden="true" class="CoreText-sc-1txzju1-0 gWcDEo">7.4K</span><p class="CoreText-sc-1txzju1-0 InjectLayout-sc-1i43xsx-0 cmeMuc">7.4K viewers</p></div></div></div></div></div><div class="Layout-sc-1xcs6mc-0 side-nav-card__link__tooltip-arrow"><div class="ScFigure-sc-wkgzod-0 caxXaW tw-svg"><svg width="20" height="20" viewBox="0 0 20 20"><path d="M7.5 7.5 10 10l-2.5 2.5L9 14l4-4-4-4-1.5 1.5z"></path></svg></div><p class="CoreText-sc-1txzju1-0 InjectLayout-sc-1i43xsx-0 cmeMuc">Use the Right Arrow Key to show more information for Mande.</p></div>',
        isLive: true,
        streamingContent: "Apex Legends",
        viewerCount: "7.4K viewers",
      },
    ],
  },
  {
    groupName: "group2",
    numberOfChannels: 2,
    order: 1,
    dialogOpen: false,
    default: false,
    dropdownVisible: false,
    numberOfLiveChannels: 0,
    followedChannels: [
      {
        channelImage:
          "https://static-cdn.jtvnw.net/jtv_user_pictures/7e2a2bbe-e6ea-49ab-9008-ddd6001919e7-profile_image-70x70.png",
        channelLink: "https://twitch.tv/zealsambitions",
        channelName: "ZealsAmbitions",
        expandedHTML:
          '<div class="Layout-sc-1xcs6mc-0 bgXDR side-nav-card__avatar side-nav-card__avatar--offline"><div class="ScAvatar-sc-144b42z-0 dmnDPS tw-avatar"><img class="InjectLayout-sc-1i43xsx-0 cXFDOs tw-image tw-image-avatar" alt="ZealsAmbitions" src="https://static-cdn.jtvnw.net/jtv_user_pictures/7e2a2bbe-e6ea-49ab-9008-ddd6001919e7-profile_image-70x70.png"></div></div><div class="Layout-sc-1xcs6mc-0 eza-dez"><div class="Layout-sc-1xcs6mc-0 iULZCz"><div data-a-target="side-nav-card-metadata" class="Layout-sc-1xcs6mc-0 cxkdpa"><div class="Layout-sc-1xcs6mc-0 xxjeD side-nav-card__title"><p title="ZealsAmbitions" data-a-target="side-nav-title" class="CoreText-sc-1txzju1-0 fdYGpZ HcPqQ InjectLayout-sc-1i43xsx-0">ZealsAmbitions</p></div><div class="Layout-sc-1xcs6mc-0 bYeGkU side-nav-card__metadata" data-a-target="side-nav-game-title"><p class="CoreText-sc-1txzju1-0 eUABfN"></p></div></div><div class="Layout-sc-1xcs6mc-0 fCKtYt side-nav-card__live-status" data-a-target="side-nav-live-status"><span class="CoreText-sc-1txzju1-0 gWcDEo">Offline</span></div></div></div><div class="Layout-sc-1xcs6mc-0 side-nav-card__link__tooltip-arrow"><div class="ScFigure-sc-wkgzod-0 caxXaW tw-svg"><svg width="20" height="20" viewBox="0 0 20 20"><path d="M7.5 7.5 10 10l-2.5 2.5L9 14l4-4-4-4-1.5 1.5z"></path></svg></div><p class="CoreText-sc-1txzju1-0 InjectLayout-sc-1i43xsx-0 cmeMuc">Use the Right Arrow Key to show more information for ZealsAmbitions.</p></div>',
        isLive: false,
        streamingContent: "",
        viewerCount: "",
      },
    ],
  },
];

describe("Delete Group", () => {
  it("should not show delete button when group is default", () => {
    render(
      <DeleteGroup
        allGroups={[]}
        group={{
          default: true,
          dialogOpen: false,
          dropdownVisible: false,
          followedChannels: [],
          groupName: "newGroup",
          numberOfChannels: 0,
          numberOfLiveChannels: 0,
          order: 2,
        }}
      />
    );
    expect(screen.getByText("Cannot delete default group")).toBeInTheDocument();
  });

  it("should not show are you sure button when first button hasn't been clicked", () => {
    render(
      <DeleteGroup
        allGroups={[]}
        group={{
          default: false,
          dialogOpen: false,
          dropdownVisible: false,
          followedChannels: [],
          groupName: "newGroup",
          numberOfChannels: 0,
          numberOfLiveChannels: 0,
          order: 2,
        }}
      />
    );
    expect(screen.getAllByRole("button").length).toBe(1);
  });

  it("should show are you sure button when first button has been clicked", () => {
    render(
      <DeleteGroup
        allGroups={[]}
        group={{
          default: false,
          dialogOpen: false,
          dropdownVisible: false,
          followedChannels: [],
          groupName: "newGroup",
          numberOfChannels: 0,
          numberOfLiveChannels: 0,
          order: 2,
        }}
      />
    );
    fireEvent.click(screen.getByRole("button"));
    expect(screen.getAllByRole("button").length).toBe(2);
  });

  it("should call setLocalStorage when are you sure has been clicked - removing group from groups list", async () => {
    render(
      <DeleteGroup
        allGroups={groupsMock}
        group={{
          default: false,
          dialogOpen: false,
          dropdownVisible: false,
          followedChannels: [],
          groupName: "newGroup",
          numberOfChannels: 0,
          numberOfLiveChannels: 0,
          order: 2,
        }}
      />
    );
    screen.getAllByRole("button").forEach((button) => {
      if(button.ariaLabel === "delete-group")
        fireEvent.click(button);
    });
    const setLocalStorageMock = await import("@src/pages/background/storage");
    fireEvent.click(screen.getByText("Are you sure?"));
    expect(setLocalStorageMock.setLocalStorage).toHaveBeenCalledWith("betterTwitchSidebar", groupsMock);
  });
});
