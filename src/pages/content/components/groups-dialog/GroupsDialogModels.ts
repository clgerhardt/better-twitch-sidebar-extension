import { Group } from "@src/pages/models/Group";
import { TableColumn } from "react-data-table-component";

export const groupColumns: TableColumn<Group>[] = [
  {
    name: "# of Channels",
    selector: (row) => row.numberOfChannels,
  },
];

export interface ManageGroupsDialogProps {
    open: boolean;
    setOpen: (open: boolean)=>void;
    followedChannels: Group[];
}