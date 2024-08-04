import DataTable from "react-data-table-component";
import { Group } from "@src/pages/models/Group";
import { ChannelsDataTable } from "./Channels";
import DeleteGroup from "./delete-group-cta/DeleteGroup";
import { EditGroupName } from "./edit-group-name/EditGroupName";

export default function GroupsDataTable({
  followedChannels,
  channelGroupMap
}: {
  followedChannels: Group[];
  channelGroupMap: any;
}) {
  const overrideGroupsColumns = [
    {
      name: "Group",
      selector: (row: Group) => row.groupName,
      cell: (row: Group) => <EditGroupName allGroups={followedChannels} group={row} channelGroupMap={channelGroupMap}/>
    },
    {
      name: "# of Channels",
      selector: (row: Group) => row.numberOfChannels,
    },
    {
      cell: (row: Group) => {
        return <DeleteGroup allGroups={followedChannels} group={row} channelGroupMap={channelGroupMap}/>
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
      expandableRowsComponentProps={{ groups: followedChannels, groupNames: followedChannels.map((group) => group.groupName.toLowerCase()), channelGroupMap: channelGroupMap }}
    />
  );
}
