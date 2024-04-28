import DataTable from "react-data-table-component";
import { groupColumns } from "../GroupsDialogModels";
import { Group } from "@src/pages/models/Group";
import ChannelsDataTable from "./channels";


export default function GroupsDataTable({followedChannels }: {followedChannels: Group[]}) {
  return (
    <DataTable
      columns={groupColumns}
      data={followedChannels}
      expandableRows
      expandableRowsComponent={ChannelsDataTable}
    />
  );
}
