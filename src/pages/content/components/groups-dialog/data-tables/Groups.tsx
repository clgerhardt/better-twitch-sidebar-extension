import DataTable from "react-data-table-component";
import { groupColumns } from "../GroupsDialogModels";
import { Group } from "@src/pages/models/Group";
import ChannelsDataTable from "./Channels";
import DeleteGroup from "./delete-group-cta/DeleteGroup";
import { EditGroupName } from "./edit-group-name/EditGroupName";

export default function GroupsDataTable({
  followedChannels,
}: {
  followedChannels: Group[];
}) {
  const overrideGroupsColumns = [
    {
      name: "Group",
      selector: (row: Group) => row.groupName,
      cell: (row: Group) => <EditGroupName allGroups={followedChannels} group={row}/>
    },
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
