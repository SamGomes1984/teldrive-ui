import type { SetValue } from "@/types";
import { shareQueries } from "@/utils/queryOptions";
import { Button, Input } from "@tw-material/react";
import PasswordIcon from "~icons/carbon/password";
import ShowPasswordIcon from "~icons/mdi/eye-outline";
import HidePasswordIcon from "~icons/mdi/eye-off-outline";
import { useCallback, useState } from "react";
import { useSuspenseQuery } from "@tanstack/react-query";
import http from "@/utils/http";
import { Controller, useForm } from "react-hook-form";
import { useSessionStorage } from "usehooks-ts";
import { SharedFileBrowser } from "@/components/SharedFileBrowser";
import type { ShareQuery, ShareQueryParams } from "@/types";
import { createFileRoute } from "@tanstack/react-router";
import { AxiosError } from "feaxios";
import { ErrorView } from "@/components/ErrorView";

export const Route = createFileRoute("/_share/share/$id")({
  component: Component,
  validateSearch: (search: Record<string, unknown>) => search as ShareQuery,
  loaderDeps: ({ search }) => search,
  loader: async ({ context: { queryClient }, params, preload, deps }) => {
    await queryClient.fetchQuery(shareQueries.share(params.id));
    const password = JSON.parse(sessionStorage.getItem("password") || "null");
    const queryParams = {
      id: params.id,
      password: password || "",
      path: deps.path || "",
    } as ShareQueryParams;

    if (preload) {
      await queryClient.prefetchInfiniteQuery(shareQueries.list(queryParams));
    } else {
      queryClient.fetchInfiniteQuery(shareQueries.list(queryParams));
    }
  },
  wrapInSuspense: true,
  errorComponent: ({ error }) => {
    let errorMessage = "server error";
    if (error instanceof AxiosError) {
      errorMessage = error.response?.data?.message || errorMessage;
    } else {
      errorMessage = error.message || errorMessage;
    }
    return <ErrorView message={errorMessage} />;
  },
});

function Component() {
  const { id } = Route.useParams();

  const { data: file } = useSuspenseQuery(shareQueries.share(id));

  const [unlockPassword, setUnlockPassword] = useSessionStorage("password", "");

  const [unlocked, setUnlocked] = useState((file.protected && !!unlockPassword) || !file.protected);

  if (!unlocked) {
    return <ShareAccess id={id} setUnlockPassword={setUnlockPassword} setUnlocked={setUnlocked} />;
  }

  return <SharedFileBrowser password={unlockPassword} />;
}

interface ShareAccessProps {
  id: string;
  setUnlocked: SetValue<boolean>;
  setUnlockPassword: SetValue<string>;
}

function ShareAccess({ id, setUnlocked, setUnlockPassword }: ShareAccessProps) {
  const [showPassword, setShowPassword] = useState(false);

  const [loading, setLoading] = useState(false);

  const { control, handleSubmit, setError } = useForm({
    defaultValues: {
      password: "",
    },
  });

  const togglePassword = () => setShowPassword((prev) => !prev);

  const onSubmit = useCallback(async ({ password }: { password: string }) => {
    try {
      setLoading(true);
      await http.post(`/api/share/${id}/unlock`, { password });
      setUnlocked(true);
      setUnlockPassword(password);
    } catch {
      setError("password", { message: "Invalid password" });
    } finally {
      setLoading(false);
    }
  }, []);

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="m-auto flex rounded-large max-w-md flex-col justify-center items-center bg-surface gap-6 p-6"
    >
      <div className="size-14 bg-secondary-container flex items-center justify-center rounded">
        <PasswordIcon className="size-8 text-on-secondary-container" />
      </div>
      <h1 className="font-medium">This link is password protected</h1>

      <Controller
        name="password"
        control={control}
        rules={{ required: true }}
        render={({ field, fieldState: { error } }) => (
          <Input
            size="lg"
            placeholder="Enter password"
            className="max-w-xs"
            variant="bordered"
            isInvalid={!!error}
            errorMessage={error?.message}
            {...field}
            aria-autocomplete="none"
            autoComplete="off"
            classNames={{
              input: showPassword ? "text-security-none" : "text-security-disc",
            }}
            endContent={
              <Button isIconOnly variant="text" onPress={togglePassword}>
                {showPassword ? <HidePasswordIcon /> : <ShowPasswordIcon />}
              </Button>
            }
          />
        )}
      />
      <Button
        isLoading={loading}
        fullWidth
        type="submit"
        variant="filledTonal"
        className="max-w-xs text-inherit"
      >
        Unlock
      </Button>
    </form>
  );
}