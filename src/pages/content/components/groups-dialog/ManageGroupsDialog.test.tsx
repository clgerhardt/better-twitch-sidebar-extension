import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import ManageFollowedChannelsDialog from "./ManageGroupsDialog";

// Mock the ResizeObserver
const ResizeObserverMock = vi.fn(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

// Stub the global ResizeObserver
vi.stubGlobal('ResizeObserver', ResizeObserverMock);

const followedChannels = [
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
        "channelImage": "https://static-cdn.jtvnw.net/jtv_user_pictures/49182eb9-e05e-401e-bee1-478e59d61fe9-profile_image-70x70.png",
        "channelLink": "https://twitch.tv/mande",
        "channelName": "Mande",
        "expandedHTML": "<div class=\"Layout-sc-1xcs6mc-0 bgXDR side-nav-card__avatar\"><div class=\"ScAvatar-sc-144b42z-0 dmnDPS tw-avatar\"><img class=\"InjectLayout-sc-1i43xsx-0 cXFDOs tw-image tw-image-avatar\" alt=\"Mande\" src=\"https://static-cdn.jtvnw.net/jtv_user_pictures/49182eb9-e05e-401e-bee1-478e59d61fe9-profile_image-70x70.png\"></div></div><div class=\"Layout-sc-1xcs6mc-0 eza-dez\"><div class=\"Layout-sc-1xcs6mc-0 iULZCz\"><div data-a-target=\"side-nav-card-metadata\" class=\"Layout-sc-1xcs6mc-0 cxkdpa\"><div class=\"Layout-sc-1xcs6mc-0 xxjeD side-nav-card__title\"><p title=\"Mande\" data-a-target=\"side-nav-title\" class=\"CoreText-sc-1txzju1-0 fdYGpZ HcPqQ InjectLayout-sc-1i43xsx-0\">Mande</p></div><div class=\"Layout-sc-1xcs6mc-0 bYeGkU side-nav-card__metadata\" data-a-target=\"side-nav-game-title\"><p title=\"Apex Legends\" class=\"CoreText-sc-1txzju1-0 eUABfN\">Apex Legends</p></div></div><div class=\"Layout-sc-1xcs6mc-0 fCKtYt side-nav-card__live-status\" data-a-target=\"side-nav-live-status\"><div class=\"Layout-sc-1xcs6mc-0 xxjeD\"><div class=\"ScChannelStatusIndicator-sc-bjn067-0 kqWDUJ tw-channel-status-indicator\"></div><p class=\"CoreText-sc-1txzju1-0 InjectLayout-sc-1i43xsx-0 cmeMuc\">Live</p><div class=\"Layout-sc-1xcs6mc-0 jOVwMQ\"><span aria-hidden=\"true\" class=\"CoreText-sc-1txzju1-0 gWcDEo\">7.4K</span><p class=\"CoreText-sc-1txzju1-0 InjectLayout-sc-1i43xsx-0 cmeMuc\">7.4K viewers</p></div></div></div></div></div><div class=\"Layout-sc-1xcs6mc-0 side-nav-card__link__tooltip-arrow\"><div class=\"ScFigure-sc-wkgzod-0 caxXaW tw-svg\"><svg width=\"20\" height=\"20\" viewBox=\"0 0 20 20\"><path d=\"M7.5 7.5 10 10l-2.5 2.5L9 14l4-4-4-4-1.5 1.5z\"></path></svg></div><p class=\"CoreText-sc-1txzju1-0 InjectLayout-sc-1i43xsx-0 cmeMuc\">Use the Right Arrow Key to show more information for Mande.</p></div>",
        "isLive": true,
        "streamingContent": "Apex Legends",
        "viewerCount": "7.4K viewers"
      },
    ]
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
        "channelImage": "https://static-cdn.jtvnw.net/jtv_user_pictures/7e2a2bbe-e6ea-49ab-9008-ddd6001919e7-profile_image-70x70.png",
        "channelLink": "https://twitch.tv/zealsambitions",
        "channelName": "ZealsAmbitions",
        "expandedHTML": "<div class=\"Layout-sc-1xcs6mc-0 bgXDR side-nav-card__avatar side-nav-card__avatar--offline\"><div class=\"ScAvatar-sc-144b42z-0 dmnDPS tw-avatar\"><img class=\"InjectLayout-sc-1i43xsx-0 cXFDOs tw-image tw-image-avatar\" alt=\"ZealsAmbitions\" src=\"https://static-cdn.jtvnw.net/jtv_user_pictures/7e2a2bbe-e6ea-49ab-9008-ddd6001919e7-profile_image-70x70.png\"></div></div><div class=\"Layout-sc-1xcs6mc-0 eza-dez\"><div class=\"Layout-sc-1xcs6mc-0 iULZCz\"><div data-a-target=\"side-nav-card-metadata\" class=\"Layout-sc-1xcs6mc-0 cxkdpa\"><div class=\"Layout-sc-1xcs6mc-0 xxjeD side-nav-card__title\"><p title=\"ZealsAmbitions\" data-a-target=\"side-nav-title\" class=\"CoreText-sc-1txzju1-0 fdYGpZ HcPqQ InjectLayout-sc-1i43xsx-0\">ZealsAmbitions</p></div><div class=\"Layout-sc-1xcs6mc-0 bYeGkU side-nav-card__metadata\" data-a-target=\"side-nav-game-title\"><p class=\"CoreText-sc-1txzju1-0 eUABfN\"></p></div></div><div class=\"Layout-sc-1xcs6mc-0 fCKtYt side-nav-card__live-status\" data-a-target=\"side-nav-live-status\"><span class=\"CoreText-sc-1txzju1-0 gWcDEo\">Offline</span></div></div></div><div class=\"Layout-sc-1xcs6mc-0 side-nav-card__link__tooltip-arrow\"><div class=\"ScFigure-sc-wkgzod-0 caxXaW tw-svg\"><svg width=\"20\" height=\"20\" viewBox=\"0 0 20 20\"><path d=\"M7.5 7.5 10 10l-2.5 2.5L9 14l4-4-4-4-1.5 1.5z\"></path></svg></div><p class=\"CoreText-sc-1txzju1-0 InjectLayout-sc-1i43xsx-0 cmeMuc\">Use the Right Arrow Key to show more information for ZealsAmbitions.</p></div>",
        "isLive": false,
        "streamingContent": "",
        "viewerCount": ""
      },
    ]
  },
];

describe("ManageGroupsDialog", () => {

  it("should render nothing when dialog is closed", () => {
   const {container} = render(<ManageFollowedChannelsDialog open={false} setOpen={()=> {return}} followedChannels={followedChannels} refreshFollowersData={()=>{return}} />);
    expect(container.querySelectorAll("div").length).toBe(0);
  });

  it("should render dialog and group table rows when open", () => {
    render(<ManageFollowedChannelsDialog open={true} setOpen={()=> {return}} followedChannels={followedChannels} refreshFollowersData={()=>{return}} />);

    const dialog = screen.getByRole("dialog");
    const title = screen.getByText("Manage your groups");

    followedChannels.forEach((group) => {
      const groupTitle = screen.getByText(group.groupName);
      expect(groupTitle).not.toBeNull();
      expect(groupTitle.textContent).toBe(group.groupName);
    });
    expect(dialog).not.toBeNull();
    expect(title.textContent).toBe("Manage your groups");
  });
});