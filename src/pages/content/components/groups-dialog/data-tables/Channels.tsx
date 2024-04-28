import { Channel } from "@src/pages/models/Channel";
import { Group } from "@src/pages/models/Group";
import React, { useState } from "react";
import DataTable, { TableColumn } from "react-data-table-component";

const channelColumns: TableColumn<Channel>[] = [
  {
    cell: (row) => (
      <div className="flex items-center">
        <img role="img" src={row.channelImage} alt="" className="w-12 h-12 rounded-full" />
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

export default function ChannelsDataTable({ data }: { data: Group }) {
  const [selectedRows, setSelectedRows] = useState<Channel[]>([]);
  const [toggleCleared, setToggleCleared] = useState(false);
  const contextActions = React.useMemo(() => {
    const handleDelete = () => {
      if (
        window.confirm(
          `Are you sure you want to delete:\r ${selectedRows.map(
            (r) => r.channelName
          )}?`
        )
      ) {
        setToggleCleared(!toggleCleared);
      }
    };

    return (
      <button key="delete" aria-label="delete-channel" onClick={handleDelete}>
        Delete
      </button>
    );
  }, [selectedRows, toggleCleared]);

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
        contextActions={contextActions}
        onSelectedRowsChange={handleRowSelected}
        clearSelectedRows={toggleCleared}
        pagination
      />
  );
}