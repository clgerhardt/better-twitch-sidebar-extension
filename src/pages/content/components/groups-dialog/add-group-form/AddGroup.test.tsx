import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { AddGroup } from "./AddGroup";
import { Group } from "@src/pages/models/Group";

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

vi.mock("@src/pages/background/storage");

const setup = (groups: Group[] = groupsMock) => {
  const utils = render(<AddGroup groups={groups} />);
  const input = screen.getByLabelText("Group Name");
  return {
    input,
    ...utils,
  };
};

describe("AddGroup", () => {
  it("should render initial elements, button disabled and form invalid for being blank", async () => {
    render(<AddGroup groups={groupsMock} />);

    const label = await screen.findByText("Group Name");
    const placeholder = await screen.queryByPlaceholderText(/Add group/i);
    const button = await screen.findByRole("button");
    const errorMessage = await screen.findByText("Group name cannot be blank");

    expect(label.textContent).toBe("Group Name");
    expect(placeholder?.getAttribute("placeholder")).toBe("Add group");
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
    const successMessage = await screen.findByText("Add a group");
    const button = await screen.findByRole("button");
    expect(successMessage.textContent).toBe("Add a group");
    expect(button).not.toBeDisabled();
  });

  it("should call updateFollowersList when form is submitted", async () => {
    const { input } = setup();
    const setLocalStorageMock = await import("@src/pages/background/storage");
    fireEvent.change(input, { target: { value: "newGroup" } });
    const button = await screen.findByRole("button");
    fireEvent.click(button);
    expect(setLocalStorageMock.setLocalStorage).toHaveBeenCalledWith(
      "betterTwitchSidebar",
      [
        {
          "default": true,
          "dialogOpen": false,
          "dropdownVisible": false,
          "followedChannels": [
            {
              "channelImage": "https://static-cdn.jtvnw.net/jtv_user_pictures/49182eb9-e05e-401e-bee1-478e59d61fe9-profile_image-70x70.png",
              "channelLink": "https://twitch.tv/mande",
              "channelName": "Mande",
              "expandedHTML": "<div class=\"Layout-sc-1xcs6mc-0 bgXDR side-nav-card__avatar\"><div class=\"ScAvatar-sc-144b42z-0 dmnDPS tw-avatar\"><img class=\"InjectLayout-sc-1i43xsx-0 cXFDOs tw-image tw-image-avatar\" alt=\"Mande\" src=\"https://static-cdn.jtvnw.net/jtv_user_pictures/49182eb9-e05e-401e-bee1-478e59d61fe9-profile_image-70x70.png\"></div></div><div class=\"Layout-sc-1xcs6mc-0 eza-dez\"><div class=\"Layout-sc-1xcs6mc-0 iULZCz\"><div data-a-target=\"side-nav-card-metadata\" class=\"Layout-sc-1xcs6mc-0 cxkdpa\"><div class=\"Layout-sc-1xcs6mc-0 xxjeD side-nav-card__title\"><p title=\"Mande\" data-a-target=\"side-nav-title\" class=\"CoreText-sc-1txzju1-0 fdYGpZ HcPqQ InjectLayout-sc-1i43xsx-0\">Mande</p></div><div class=\"Layout-sc-1xcs6mc-0 bYeGkU side-nav-card__metadata\" data-a-target=\"side-nav-game-title\"><p title=\"Apex Legends\" class=\"CoreText-sc-1txzju1-0 eUABfN\">Apex Legends</p></div></div><div class=\"Layout-sc-1xcs6mc-0 fCKtYt side-nav-card__live-status\" data-a-target=\"side-nav-live-status\"><div class=\"Layout-sc-1xcs6mc-0 xxjeD\"><div class=\"ScChannelStatusIndicator-sc-bjn067-0 kqWDUJ tw-channel-status-indicator\"></div><p class=\"CoreText-sc-1txzju1-0 InjectLayout-sc-1i43xsx-0 cmeMuc\">Live</p><div class=\"Layout-sc-1xcs6mc-0 jOVwMQ\"><span aria-hidden=\"true\" class=\"CoreText-sc-1txzju1-0 gWcDEo\">7.4K</span><p class=\"CoreText-sc-1txzju1-0 InjectLayout-sc-1i43xsx-0 cmeMuc\">7.4K viewers</p></div></div></div></div></div><div class=\"Layout-sc-1xcs6mc-0 side-nav-card__link__tooltip-arrow\"><div class=\"ScFigure-sc-wkgzod-0 caxXaW tw-svg\"><svg width=\"20\" height=\"20\" viewBox=\"0 0 20 20\"><path d=\"M7.5 7.5 10 10l-2.5 2.5L9 14l4-4-4-4-1.5 1.5z\"></path></svg></div><p class=\"CoreText-sc-1txzju1-0 InjectLayout-sc-1i43xsx-0 cmeMuc\">Use the Right Arrow Key to show more information for Mande.</p></div>",
              "isLive": true,
              "streamingContent": "Apex Legends",
              "viewerCount": "7.4K viewers",
            },
          ],
          "groupName": "group1",
          "numberOfChannels": 1,
          "numberOfLiveChannels": 0,
          "order": 0,
        },
        {
          "default": false,
          "dialogOpen": false,
          "dropdownVisible": false,
          "followedChannels": [
            {
              "channelImage": "https://static-cdn.jtvnw.net/jtv_user_pictures/7e2a2bbe-e6ea-49ab-9008-ddd6001919e7-profile_image-70x70.png",
              "channelLink": "https://twitch.tv/zealsambitions",
              "channelName": "ZealsAmbitions",
              "expandedHTML": "<div class=\"Layout-sc-1xcs6mc-0 bgXDR side-nav-card__avatar side-nav-card__avatar--offline\"><div class=\"ScAvatar-sc-144b42z-0 dmnDPS tw-avatar\"><img class=\"InjectLayout-sc-1i43xsx-0 cXFDOs tw-image tw-image-avatar\" alt=\"ZealsAmbitions\" src=\"https://static-cdn.jtvnw.net/jtv_user_pictures/7e2a2bbe-e6ea-49ab-9008-ddd6001919e7-profile_image-70x70.png\"></div></div><div class=\"Layout-sc-1xcs6mc-0 eza-dez\"><div class=\"Layout-sc-1xcs6mc-0 iULZCz\"><div data-a-target=\"side-nav-card-metadata\" class=\"Layout-sc-1xcs6mc-0 cxkdpa\"><div class=\"Layout-sc-1xcs6mc-0 xxjeD side-nav-card__title\"><p title=\"ZealsAmbitions\" data-a-target=\"side-nav-title\" class=\"CoreText-sc-1txzju1-0 fdYGpZ HcPqQ InjectLayout-sc-1i43xsx-0\">ZealsAmbitions</p></div><div class=\"Layout-sc-1xcs6mc-0 bYeGkU side-nav-card__metadata\" data-a-target=\"side-nav-game-title\"><p class=\"CoreText-sc-1txzju1-0 eUABfN\"></p></div></div><div class=\"Layout-sc-1xcs6mc-0 fCKtYt side-nav-card__live-status\" data-a-target=\"side-nav-live-status\"><span class=\"CoreText-sc-1txzju1-0 gWcDEo\">Offline</span></div></div></div><div class=\"Layout-sc-1xcs6mc-0 side-nav-card__link__tooltip-arrow\"><div class=\"ScFigure-sc-wkgzod-0 caxXaW tw-svg\"><svg width=\"20\" height=\"20\" viewBox=\"0 0 20 20\"><path d=\"M7.5 7.5 10 10l-2.5 2.5L9 14l4-4-4-4-1.5 1.5z\"></path></svg></div><p class=\"CoreText-sc-1txzju1-0 InjectLayout-sc-1i43xsx-0 cmeMuc\">Use the Right Arrow Key to show more information for ZealsAmbitions.</p></div>",
              "isLive": false,
              "streamingContent": "",
              "viewerCount": "",
            },
          ],
          "groupName": "group2",
          "numberOfChannels": 2,
          "numberOfLiveChannels": 0,
          "order": 1,
        },
        {
          default: false,
          dialogOpen: false,
          dropdownVisible: false,
          followedChannels: [],
          groupName: "newGroup",
          numberOfChannels: 0,
          numberOfLiveChannels: 0,
          order: 2,
        }
      ]
    );
  });
});
