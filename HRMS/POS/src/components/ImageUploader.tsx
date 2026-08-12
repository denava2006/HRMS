import { useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Upload, Link as LinkIcon, X, Loader2 } from "lucide-react";
import { ProductImage } from "./ProductImage";
import { toast } from "sonner";

export function ImageUploader({
  value,
  onChange,
  storeId,
}: {
  value: string | null | undefined;
  onChange: (url: string | null) => void;
  storeId: string;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [urlInput, setUrlInput] = useState("");

  const handleFile = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image must be under 5MB");
      return;
    }
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${storeId}/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from("product-images").upload(path, file, {
        cacheControl: "3600",
        upsert: false,
      });
      if (error) throw error;
      const { data } = supabase.storage.from("product-images").getPublicUrl(path);
      onChange(data.publicUrl);
      toast.success("Image uploaded");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setUploading(false);
    }
  };

  const applyUrl = () => {
    const u = urlInput.trim();
    if (!u) return;
    onChange(u);
    setUrlInput("");
  };

  return (
    <div className="space-y-2">
      <Label>Product Image</Label>
      <div className="flex gap-3 items-start">
        <ProductImage src={value} name="?" className="w-24 h-24 rounded-lg border border-border shrink-0" iconSize="w-6 h-6" />
        <div className="flex-1 space-y-2 min-w-0">
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={uploading}
              onClick={() => fileRef.current?.click()}
              className="flex-1"
            >
              {uploading ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Upload className="w-4 h-4 mr-1" />}
              Upload
            </Button>
            {value && (
              <Button type="button" variant="outline" size="sm" onClick={() => onChange(null)} className="text-destructive">
                <X className="w-4 h-4" />
              </Button>
            )}
          </div>
          <div className="flex gap-1">
            <div className="relative flex-1">
              <LinkIcon className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input
                placeholder="Paste image URL"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), applyUrl())}
                className="pl-7 h-8 text-xs"
              />
            </div>
            <Button type="button" size="sm" variant="secondary" onClick={applyUrl} className="h-8">Set</Button>
          </div>
        </div>
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
          e.target.value = "";
        }}
      />
    </div>
  );
}
