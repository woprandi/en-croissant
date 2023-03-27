import { Button, Modal, Select, TextInput } from "@mantine/core";
import { useLocalStorage } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import { IconX } from "@tabler/icons-react";
import { invoke } from "@tauri-apps/api";
import { listen } from "@tauri-apps/api/event";
import { useEffect, useRef, useState } from "react";
import { getChessComAccount } from "../../utils/chesscom";
import { DatabaseInfo, getDatabases } from "../../utils/db";
import { createCodes, getLichessAccount } from "../../utils/lichess";
import { Session } from "../../utils/session";
import AccountCards from "../common/AccountCards";

function Accounts() {
  const [sessions, setSessions] = useLocalStorage<Session[]>({
    key: "sessions",
    defaultValue: [],
  });
  const authWindow = useRef<Window | null>(null);
  const isListesning = useRef(false);
  const [databases, setDatabases] = useState<DatabaseInfo[]>([]);
  useEffect(() => {
    getDatabases().then((dbs) => setDatabases(dbs));
  }, []);
  const [open, setOpen] = useState(false);

  async function listen_for_code() {
    if (isListesning.current) return;
    isListesning.current = true;
    await listen("redirect_uri", async (event) => {
      if (authWindow.current) authWindow.current.close();
      const token = event.payload as string;
      const account = await getLichessAccount(token);
      setSessions((sessions) => [
        ...sessions,
        { lichess: { accessToken: token, account }, updatedAt: Date.now() },
      ]);
    });
  }

  async function login(clientId: string) {
    const { verifier, challenge } = await createCodes();
    const port = await invoke("start_server", { verifier: verifier });

    authWindow.current = window.open(
      "https://lichess.org/oauth?" +
        new URLSearchParams({
          response_type: "code",
          client_id: clientId,
          redirect_uri: `http://localhost:${port}`,
          scope: "preference:read",
          code_challenge_method: "S256",
          code_challenge: challenge,
        }),
      "_blank"
    );
  }

  useEffect(() => {
    listen_for_code();
  }, []);

  return (
    <>
      <AccountCards
        sessions={sessions}
        databases={databases}
        setDatabases={setDatabases}
        setSessions={setSessions}
      />

      <Button onClick={() => setOpen(true)}>Add Account</Button>
      <AccountModal
        open={open}
        setOpen={setOpen}
        addLichess={login}
        addChessCom={(u) => {
          getChessComAccount(u)
            .then((stats) => {
              setSessions((sessions) => [
                ...sessions,
                { chessCom: { username: u, stats }, updatedAt: Date.now() },
              ]);
            })
            .catch(() => {
              notifications.show({
                title: "Failed to add account",
                message: 'Could not find account "' + u + '" on chess.com',
                color: "red",
                icon: <IconX />,
              });
            });
        }}
      />
    </>
  );
}

export default Accounts;

function AccountModal({
  open,
  setOpen,
  addLichess,
  addChessCom,
}: {
  open: boolean;
  setOpen: (open: boolean) => void;
  addLichess: (username: string) => void;
  addChessCom: (username: string) => void;
}) {
  const [username, setUsername] = useState("");
  const [website, setWebsite] = useState<"lichess" | "chesscom">("lichess");

  function addAccount() {
    if (website === "lichess") {
      addLichess(username);
    } else {
      addChessCom(username);
    }
    setOpen(false);
  }

  return (
    <Modal opened={open} onClose={() => setOpen(false)} title="Add Account">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          addAccount();
        }}
      >
        <Select
          label="Website"
          placeholder="Select website"
          data={[
            { label: "Lichess", value: "lichess" },
            { label: "Chess.com", value: "chesscom" },
          ]}
          value={website}
          onChange={(e) => setWebsite(e as any)}
          required
        />
        <TextInput
          label="Username"
          placeholder="Enter your username"
          required
          value={username}
          onChange={(e) => setUsername(e.currentTarget.value)}
        />
        <Button sx={{ marginTop: "1rem" }} type="submit">
          Add
        </Button>
      </form>
    </Modal>
  );
}
