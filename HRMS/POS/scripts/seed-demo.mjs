import { execFileSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";

const command = process.platform === "win32"
  ? { file: process.env.ComSpec || "cmd.exe", args: ["/d", "/s", "/c", "npx.cmd supabase status -o env"] }
  : { file: "npx", args: ["supabase", "status", "-o", "env"] };
const output = execFileSync(command.file, command.args, {
  cwd: new URL("..", import.meta.url),
  encoding: "utf8",
  stdio: ["ignore", "pipe", "pipe"],
});

const settings = Object.fromEntries(
  output
    .split(/\r?\n/)
    .map((line) => line.match(/^([A-Z0-9_]+)=(.*)$/))
    .filter(Boolean)
    .map((match) => [match[1], match[2].trim().replace(/^"|"$/g, "")])
);

const apiUrl = settings.API_URL;
const serviceKey = settings.SERVICE_ROLE_KEY;
const anonKey = settings.ANON_KEY;
if (!apiUrl || !serviceKey || !anonKey) throw new Error("Local Supabase credentials could not be detected.");

const parsedUrl = new URL(apiUrl);
if (parsedUrl.hostname !== "localhost" && parsedUrl.hostname !== "127.0.0.1") {
  throw new Error("Demo seeding is blocked because the Supabase API is not local.");
}

const supabase = createClient(apiUrl, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const demoAccounts = [
  { role: "admin", email: "admin@sariswift.local", password: "Admin123!", display_name: "Demo Admin" },
  { role: "manager", email: "manager@sariswift.local", password: "Manager123!", display_name: "Demo Manager" },
  { role: "cashier", email: "cashier@sariswift.local", password: "Cashier123!", display_name: "Demo Cashier" },
];

async function findUser(email) {
  for (let page = 1; ; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    const user = data.users.find((item) => item.email?.toLowerCase() === email);
    if (user) return user;
    if (data.users.length < 1000) return null;
  }
}

async function ensureUser(account) {
  const existing = await findUser(account.email);
  if (existing) {
    const { data, error } = await supabase.auth.admin.updateUserById(existing.id, {
      password: account.password,
      email_confirm: true,
      user_metadata: { display_name: account.display_name },
    });
    if (error) throw error;
    return data.user;
  }
  const { data, error } = await supabase.auth.admin.createUser({
    email: account.email,
    password: account.password,
    email_confirm: true,
    user_metadata: { display_name: account.display_name },
  });
  if (error || !data.user) throw error ?? new Error(`Could not create ${account.email}.`);
  return data.user;
}

const users = new Map();
for (const account of demoAccounts) {
  users.set(account.email, await ensureUser(account));
}

const adminUser = users.get("admin@sariswift.local");
const { data: existingStore, error: storeLookupError } = await supabase
  .from("stores")
  .select("id")
  .eq("name", "SariSwift Demo Store")
  .maybeSingle();
if (storeLookupError) throw storeLookupError;

let storeId = existingStore?.id;
if (!storeId) {
  const { data: store, error } = await supabase
    .from("stores")
    .insert({
      name: "SariSwift Demo Store",
      owner_id: adminUser.id,
      owner_name: "Demo Admin",
      currency: "PHP",
    })
    .select("id")
    .single();
  if (error || !store) throw error ?? new Error("Could not create the demo store.");
  storeId = store.id;
}

for (const account of demoAccounts) {
  const user = users.get(account.email);
  const { error } = await supabase.from("store_memberships").upsert({
    store_id: storeId,
    user_id: user.id,
    role: account.role,
    status: "active",
    display_name: account.display_name,
    created_by: adminUser.id,
  }, { onConflict: "store_id,user_id" });
  if (error) throw error;
}

const storeClient = createClient(apiUrl, anonKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const { error: adminSignInError } = await storeClient.auth.signInWithPassword({
  email: "admin@sariswift.local",
  password: "Admin123!",
});
if (adminSignInError) throw adminSignInError;

const demoCategories = [
  "General", "Beverages", "Coffee", "Noodles", "Snacks",
  "Personal Care", "Household", "Canned Goods", "Fresh Goods",
];

async function ensureDemoCategory(name, sortOrder) {
  const normalizedName = name.trim().toLowerCase();
  const findCategory = () => supabase
    .from("product_categories")
    .select("id")
    .eq("store_id", storeId)
    .eq("normalized_name", normalizedName)
    .maybeSingle();

  const { data: existing, error: lookupError } = await findCategory();
  if (lookupError) throw lookupError;

  if (existing) {
    const { error } = await supabase
      .from("product_categories")
      .update({
        name,
        is_active: true,
        sort_order: sortOrder,
      })
      .eq("id", existing.id)
      .eq("store_id", storeId);
    if (error) throw error;
    return existing.id;
  }

  const { data: inserted, error: insertError } = await supabase
    .from("product_categories")
    .insert({
      store_id: storeId,
      name,
      is_active: true,
      sort_order: sortOrder,
      created_by: adminUser.id,
    })
    .select("id")
    .single();

  if (!insertError && inserted) return inserted.id;
  if (insertError?.code !== "23505") throw insertError;

  // Another run may have inserted the same normalized name after our lookup.
  // Resolve the unique-key race without ever updating immutable columns.
  const { data: concurrent, error: concurrentLookupError } = await findCategory();
  if (concurrentLookupError || !concurrent) {
    throw concurrentLookupError ?? insertError;
  }
  const { error: concurrentUpdateError } = await supabase
    .from("product_categories")
    .update({
      name,
      is_active: true,
      sort_order: sortOrder,
    })
    .eq("id", concurrent.id)
    .eq("store_id", storeId);
  if (concurrentUpdateError) throw concurrentUpdateError;
  return concurrent.id;
}

for (const [sortOrder, name] of demoCategories.entries()) {
  await ensureDemoCategory(name, sortOrder);
}

const { data: categoryRows, error: categoryError } = await supabase
  .from("product_categories")
  .select("id,normalized_name")
  .eq("store_id", storeId);
if (categoryError) throw categoryError;
const categoryIds = new Map(categoryRows.map((category) => [category.normalized_name, category.id]));

const demoProducts = [
  ["Coca-Cola 1.5L", "Beverages", 24, 55, 75],
  ["Bottled Water", "Beverages", 48, 10, 15],
  ["Nescafe 3-in-1", "Coffee", 100, 5, 8],
  ["Lucky Me Pancit Canton", "Noodles", 80, 12, 18],
  ["Piattos 40g", "Snacks", 30, 18, 25],
  ["Biscuits", "Snacks", 40, 6, 10],
  ["Palmolive Shampoo Sachet", "Personal Care", 60, 5, 8],
  ["Tide Powder", "Household", 40, 9, 14],
  ["Detergent Sachet", "Household", 50, 7, 12],
  ["Argentina Corned Beef", "Canned Goods", 20, 32, 45],
  ["Eggs", "Fresh Goods", 50, 7, 10],
];

for (const [name, category, stock, buyingPrice, sellingPrice] of demoProducts) {
  const categoryId = categoryIds.get(category.toLowerCase());
  const { data: existingProduct, error: productLookupError } = await storeClient
    .from("products")
    .select("id")
    .eq("store_id", storeId)
    .eq("name", name)
    .maybeSingle();
  if (productLookupError) throw productLookupError;
  if (existingProduct) {
    const { error } = await storeClient.from("products").update({ category_id: categoryId }).eq("id", existingProduct.id);
    if (error) throw error;
  } else {
    const { error } = await storeClient.from("products").insert({
      store_id: storeId, name, category_id: categoryId, stock,
      buying_price: buyingPrice, selling_price: sellingPrice, is_demo: true,
    });
    if (error) throw error;
  }
}

console.log("Local demo accounts are ready for SariSwift Demo Store.");
