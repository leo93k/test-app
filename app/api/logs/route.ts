import { NextRequest } from "next/server";
import { addLog, getLogs, clearLogs } from "./logStore";

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const lastId = searchParams.get("lastId") || "0";

    // 새로운 로그만 반환
    const result = getLogs(lastId);

    return new Response(JSON.stringify(result), {
        headers: {
            "Content-Type": "application/json",
            "Cache-Control": "no-cache",
            Connection: "keep-alive",
        },
    });
}

export async function POST(request: NextRequest) {
    const { message, type = "info" } = await request.json();

    addLog(message, type);

    return new Response(JSON.stringify({ success: true }), {
        headers: { "Content-Type": "application/json" },
    });
}

export async function DELETE(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get("action");

    if (action === "clear") {
        clearLogs();
        return new Response(
            JSON.stringify({
                success: true,
                message: "모든 로그가 삭제되었습니다.",
            }),
            {
                headers: { "Content-Type": "application/json" },
            }
        );
    }

    return new Response(
        JSON.stringify({ success: false, message: "잘못된 요청입니다." }),
        {
            status: 400,
            headers: { "Content-Type": "application/json" },
        }
    );
}
