import { Channel } from "@src/pages/models/Channel";
import { Group } from "@src/pages/models/Group";
import React, { useState } from "react";
import DataTable, {
  ExpanderComponentProps,
  TableColumn,
} from "react-data-table-component";
import { SelectedChannels } from "./selected-channels/SelectedChannels";

const channelColumns: TableColumn<Channel>[] = [
  {
    cell: (row) => (
      <div className="flex items-center">
        <img
          role="img"
          src={row.channelImage}
          alt=""
          className="w-12 h-12 rounded-full"
        />
        <a
          href={row.channelLink}
          style={{ marginLeft: "5px", fill: "#43a047" }}
          role="link"
        >
          {row.channelName}
        </a>
      </div>
    ),
    name: "Channel",
    selector: (row) => row.channelName,
  },
  {
    cell: (row) => (row.isLive ? <div> Online </div> : <div> Offline </div>),
    name: "Live",
    selector: (row) => row.isLive,
  },
  {
    cell: (row) =>
      row.viewerCount ? <div> {row.viewerCount} </div> : <div> 0 viewers </div>,
    name: "Viewers",
    selector: (row) => row.viewerCount,
  },
  {
    name: "Streaming Content",
    selector: (row) => row.streamingContent,
  },
];

interface Props extends ExpanderComponentProps<Group> {
  // currently, props that extend ExpanderComponentProps must be set to optional.
  groupNames?: string[];
  groups?: Group[];
  channelGroupMap?: any;
}

export const ChannelsDataTable: React.FC<Props> = ({ data, groupNames, groups, channelGroupMap }) => {
  const [selectedRows, setSelectedRows] = useState<Channel[]>([]);
  const [toggleCleared, setToggleCleared] = useState(false);

  const handleRowSelected = React.useCallback(
    (state: {
      allSelected: boolean;
      selectedCount: number;
      selectedRows: Channel[];
    }) => {
      setSelectedRows(state.selectedRows);
    },
    []
  );

  return (
    <DataTable
      title={data.groupName}
      columns={channelColumns}
      data={data.followedChannels}
      selectableRows
      contextComponent={
        <SelectedChannels
          groupNames={
            groupNames?.filter(
              (gn) => data.groupName.toLowerCase() !== gn.toLowerCase()
            ) ?? []
          }
          selectedRows={selectedRows}
          groups={groups ?? []}
          currentGroup={data.groupName}
          setToggleCleared={setToggleCleared}
          setSelectedRows={setSelectedRows}
          channelGroupMap={channelGroupMap}
        />
      }
      onSelectedRowsChange={handleRowSelected}
      clearSelectedRows={toggleCleared}
      pagination
    />
  );
};
