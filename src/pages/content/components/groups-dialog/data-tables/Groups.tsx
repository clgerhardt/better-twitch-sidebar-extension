import DataTable from "react-data-table-component";
import { groupColumns } from "../GroupsDialogModels";
import { Group } from "@src/pages/models/Group";
import ChannelsDataTable from "./Channels";
import DeleteGroup from "./delete-group-cta/DeleteGroup";

export default function GroupsDataTable({
  followedChannels,
}: {
  followedChannels: Group[];
}) {
  const overrideGroupsColumns = [
    ...groupColumns,
    {
      cell: (row: Group) => {
        return <DeleteGroup allGroups={followedChannels} group={row}/>
      },
      name: "Actions",
    },
  ];

  return (
    <DataTable
      columns={overrideGroupsColumns}
      data={followedChannels}
      expandableRows
      expandableRowsComponent={ChannelsDataTable}
    />
  );
}
