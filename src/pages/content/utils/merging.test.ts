import { describe, expect, it } from "vitest";
import { mergeChannels } from "./merging";

const groups = [
  {
    groupName: "group1",
    default: true,
    dialogOpen: false,
    dropdownVisible: false,
    numberOfChannels: 0,
    numberOfLiveChannels: 0,
    order: 2,
    followedChannels: [
      {
        channelName: "channel3",
        channelImage: "image",
        channelLink: "link",
        expandedHTML: "expandedHTML",
        isLive: true,
        streamingContent: "game",
        viewerCount: "1 viewers",
      },
    ],
  },
  {
    groupName: "group2",
    default: false,
    dialogOpen: false,
    dropdownVisible: false,
    numberOfChannels: 0,
    numberOfLiveChannels: 0,
    order: 2,
    followedChannels: [],
  },
];
const channels = [
  {
    channelName: "channel1",
    channelImage: "image",
    channelLink: "link",
    expandedHTML: "expandedHTML",
    isLive: true,
    streamingContent: "game",
    viewerCount: "1 viewers",
  },
  {
    channelName: "channel2",
    channelImage: "image",
    channelLink: "link",
    expandedHTML: "expandedHTML",
    isLive: true,
    streamingContent: "game",
    viewerCount: "1 viewers",
  },
];

describe("Merging", () => {
  it("should merge channels into default group if no group name is passed", () => {
    const result = [
      {
        groupName: "group1",
        default: true,
        dialogOpen: false,
        dropdownVisible: false,
        numberOfChannels: 3,
        numberOfLiveChannels: 0,
        order: 2,
        followedChannels: [
          {
            channelName: "channel3",
            channelImage: "image",
            channelLink: "link",
            expandedHTML: "expandedHTML",
            isLive: true,
            streamingContent: "game",
            viewerCount: "1 viewers",
          },
          {
            channelName: "channel1",
            channelImage: "image",
            channelLink: "link",
            expandedHTML: "expandedHTML",
            isLive: true,
            streamingContent: "game",
            viewerCount: "1 viewers",
          },
          {
            channelName: "channel2",
            channelImage: "image",
            channelLink: "link",
            expandedHTML: "expandedHTML",
            isLive: true,
            streamingContent: "game",
            viewerCount: "1 viewers",
          },
        ],
      },
      {
        groupName: "group2",
        default: false,
        dialogOpen: false,
        dropdownVisible: false,
        numberOfChannels: 0,
        numberOfLiveChannels: 0,
        order: 2,
        followedChannels: [],
      }
    ];
    expect(mergeChannels(groups, channels)).toEqual(result);
  });

  it("should merge channels into specified group", () => {
    const result = [
      {
        groupName: "group1",
        default: true,
        dialogOpen: false,
        dropdownVisible: false,
        numberOfChannels: 0,
        numberOfLiveChannels: 0,
        order: 2,
        followedChannels: [
          {
            channelName: "channel3",
            channelImage: "image",
            channelLink: "link",
            expandedHTML: "expandedHTML",
            isLive: true,
            streamingContent: "game",
            viewerCount: "1 viewers",
          }
        ],
      },
      {
        groupName: "group2",
        default: false,
        dialogOpen: false,
        dropdownVisible: false,
        numberOfChannels: 2,
        numberOfLiveChannels: 0,
        order: 2,
        followedChannels: [
          {
            channelName: "channel1",
            channelImage: "image",
            channelLink: "link",
            expandedHTML: "expandedHTML",
            isLive: true,
            streamingContent: "game",
            viewerCount: "1 viewers",
          },
          {
            channelName: "channel2",
            channelImage: "image",
            channelLink: "link",
            expandedHTML: "expandedHTML",
            isLive: true,
            streamingContent: "game",
            viewerCount: "1 viewers",
          },
        ],
      }
    ];

    expect(mergeChannels(groups, channels, "group2")).toEqual(result);
  });
});
