import { useNowMinute } from "../../hooks/useNowMinute";
import { formatRelativeTimeLabel } from "../../timestampFormat";
import { Tooltip, TooltipPopup, TooltipTrigger } from "../ui/tooltip";

export function WorkspaceUpdatedTime({ timestamp }: { timestamp: string }) {
  const minute = useNowMinute();
  const nowMs = Date.parse(`${minute}:00.000Z`);
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <time
            dateTime={timestamp}
            className="hidden text-right font-mono text-2xs text-muted-foreground sm:block"
          />
        }
      >
        {formatRelativeTimeLabel(timestamp, nowMs)}
      </TooltipTrigger>
      <TooltipPopup>{new Date(timestamp).toLocaleString()}</TooltipPopup>
    </Tooltip>
  );
}
