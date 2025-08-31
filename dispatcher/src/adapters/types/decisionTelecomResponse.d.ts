export type decisionTelecomResponse = {
  message_data: [
    {
        message_id: number,
        phone: number,
        part_count: number,
        concat_part: number,
        status: "ACCEPTD" | "REJECTD" | "EXPIRED" | "UNDELIV" | "DELIVRD" | "ENROUTE" | "UNKNOWN" | "DELETED",
    }
  ]
}
