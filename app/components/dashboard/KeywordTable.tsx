import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TrendingDown, TrendingUp, Link2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";

interface Keyword {
  keyword: string;
  clicks: number;
  impressions: number;
  position: number;
  ctr: string;
  page?: string; // optional in case some rows don't include it
}

interface KeywordTableProps {
  keywords: Keyword[];
  title: string;
  description?: string;
  renderActions?: (keyword: Keyword) => React.ReactNode; // ✅ new prop
}

const KeywordTable = ({ keywords, title, description }: KeywordTableProps) => {
  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 10;

  const totalPages = Math.ceil(keywords.length / rowsPerPage);
  const paginatedKeywords = keywords.slice(
    (currentPage - 1) * rowsPerPage,
    currentPage * rowsPerPage
  );

  return (
    <div>
      <h3 className="text-sm font-medium mb-2">{title}</h3>
      {description && (
        <p className="text-sm text-muted-foreground mb-4">{description}</p>
      )}
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Keyword</TableHead>
              <TableHead className="text-right">Clicks</TableHead>
              <TableHead className="text-right">Position</TableHead>
              <TableHead className="text-right">Impressions</TableHead>
              <TableHead className="text-left">Page</TableHead>
              {/* <TableHead className="text-right">CTR</TableHead> */}
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedKeywords.map((item, index) => (
              <TableRow key={index}>
                <TableCell className="font-medium">{item.keyword}</TableCell>
                <TableCell className="text-right">{item.clicks}</TableCell>
                <TableCell className="text-right flex items-center justify-end gap-1">
                  {item.position}
                  {item.position <= 10 ? (
                    <TrendingUp className="h-4 w-4 text-green-500" />
                  ) : (
                    <TrendingDown className="h-4 w-4 text-yellow-500" />
                  )}
                </TableCell>
                <TableCell className="text-right">{item.impressions}</TableCell>
                <TableCell className="text-left">
                  {item.page ? (
                    <a
                      href={item.page}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[#00BF63] underline"
                    >
                      {item.page.replace(/^https?:\/\//, "").slice(0, 40)}...
                    </a>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
                {/* <TableCell className="text-right">{item.ctr}</TableCell> */}
                {/* <TableCell className="text-right">
                  {item.page && (
                    <HoverCard>
                      <HoverCardTrigger asChild>
                        <button className="inline-flex items-center text-muted-foreground hover:text-primary">
                          <Link2 className="h-4 w-4" />
                        </button>
                      </HoverCardTrigger>
                      <HoverCardContent className="w-80">
                        <div className="space-y-2">
                          <p className="text-sm font-medium">Page URL</p>
                          <p className="text-sm text-muted-foreground break-all">
                            {item.page}
                          </p>
                        </div>
                      </HoverCardContent>
                    </HoverCard>
                  )}
                </TableCell> */}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Pagination controls */}
      {totalPages > 1 && (
        <div className="flex justify-end mt-4 space-x-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={currentPage === 1}
          >
            Previous
          </Button>
          <span className="text-sm text-muted-foreground self-center">
            Page {currentPage} of {totalPages}
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
};

export default KeywordTable;
