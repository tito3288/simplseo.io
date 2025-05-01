import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CalendarDays } from "lucide-react";

interface DateRangeFilterProps {
  value: string;
  onValueChange: (value: string) => void;
}

const DateRangeFilter = ({ value, onValueChange }: DateRangeFilterProps) => {
  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger className="w-[180px]">
        <CalendarDays className="mr-2 h-4 w-4" />
        <SelectValue placeholder="Select date range" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="7">Last 7 days</SelectItem>
        <SelectItem value="28">Last 28 days</SelectItem>
        <SelectItem value="90">Last 3 months</SelectItem>
        <SelectItem value="all">All time</SelectItem>
      </SelectContent>
    </Select>
  );
};

export default DateRangeFilter;
