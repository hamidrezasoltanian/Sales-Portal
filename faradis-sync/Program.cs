using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Security.Cryptography;
using System.Text;
using System.Threading;
using Microsoft.Data.SqlClient;
using Newtonsoft.Json;

namespace FaradisSync
{
    class Program
    {
        // ─── تنظیمات ──────────────────────────────────────────────────────────
        static readonly string SrcConn =
            "Server=192.168.4.4\\FARADISSOFT,50727;" +
            "Database=faradissoftatenazist;" +
            "User Id=ma;Password=adminS@2;" +
            "TrustServerCertificate=True;Encrypt=False;";

        static readonly string DstConn =
            "Server=localhost\\SQLEXPRESS;" +
            "Database=faradis_local;" +
            "Integrated Security=True;" +
            "TrustServerCertificate=True;";

        static readonly string DstMaster =
            "Server=localhost\\SQLEXPRESS;" +
            "Database=master;" +
            "Integrated Security=True;" +
            "TrustServerCertificate=True;";

        static int LoopSec = 60;        // فاصله بین هر دور سینک (ثانیه)
        static int GCEvery = 60;        // هر چند دور garbage-collect انجام شود (60 دور = هر ساعت)
        static string HashFile = "sync_hashes.json";
        static Dictionary<string, string> Hashes = new();

        // ─── main ─────────────────────────────────────────────────────────────
        static void Main(string[] args)
        {
            Console.Title = "Faradis → Local Sync";
            Print("═══════════════════════════════════════", ConsoleColor.Cyan);
            Print("  FARADIS LOCAL SYNC  —  فرادیس به محلی", ConsoleColor.Cyan);
            Print("═══════════════════════════════════════\n", ConsoleColor.Cyan);

            LoadHashes();
            InitSchema();

            // نمایش ستون‌های Factor و FactorRow برای تشخیص نام‌های صحیح
            Print("\n--- ستون‌های جداول فروش در فرادیس ---", ConsoleColor.Yellow);
            ShowColumns("Factor");
            ShowColumns("FactorRow");
            Print("--------------------------------------\n", ConsoleColor.Yellow);

            int loop = 0;
            while (true)
            {
                loop++;
                bool gc = (loop % GCEvery == 0);
                try
                {
                    Print($"\n[{Now()}] دور {loop} شروع شد...", ConsoleColor.White);

                    SyncTable("stuffs",       GetStuffsQ(),      new[] { "StuffNum" },              gc);
                    SyncTable("stores",       GetStoresQ(),      new[] { "StoreNum" },              gc);
                    SyncTable("store_stuffs", GetStoreStuffsQ(), new[] { "StoreStuffNum" },         gc);
                    SyncTable("customers",    GetCustomersQ(),   new[] { "CompanyNum" },            gc);
                    SyncTable("phones",       GetPhonesQ(),      new[] { "RowNum", "Phone" },       gc);
                    SyncTable("addresses",    GetAddressesQ(),   new[] { "CompanyNum" },            gc);
                    SyncTable("followers",    GetFollowersQ(),   new[] { "CompanyNum", "UserName" },gc);
                    SyncTable("factors",      GetFactorsQ(),     new[] { "FactorID" },              gc);
                    SyncTable("factor_rows",  GetFactorRowsQ(),  new[] { "FactorRowNum" },          gc);

                    SaveHashes();
                    Print($"[{Now()}] ✓ دور {loop} با موفقیت کامل شد.", ConsoleColor.Green);
                }
                catch (Exception ex)
                {
                    Print($"[خطای کلی] {ex.Message}", ConsoleColor.Red);
                    if (ex.InnerException != null)
                        Print($"  ← {ex.InnerException.Message}", ConsoleColor.Red);
                }

                Print($"انتظار {LoopSec} ثانیه...", ConsoleColor.DarkGray);
                Thread.Sleep(LoopSec * 1000);
            }
        }

        // ─── راه‌اندازی schema ────────────────────────────────────────────────
        static void InitSchema()
        {
            Console.Write("راه‌اندازی پایگاه داده محلی... ");

            using (var c = Open(DstMaster))
                Exec(c, @"IF NOT EXISTS (SELECT name FROM sys.databases WHERE name='faradis_local')
                           CREATE DATABASE faradis_local COLLATE Persian_100_CI_AI");

            using var conn = Open(DstConn);

            Exec(conn, @"IF NOT EXISTS (SELECT * FROM sys.tables WHERE name='stuffs')
            CREATE TABLE stuffs (
                StuffNum      INT            PRIMARY KEY,
                ParentNum     INT,
                StuffName     NVARCHAR(500),
                StuffCode     NVARCHAR(100),
                TechnicalCode NVARCHAR(100),
                IranCode      NVARCHAR(100),
                Barcode       NVARCHAR(100),
                Price         DECIMAL(18,4),
                Active        BIT,
                SaveDate      NVARCHAR(50),
                EditDate      NVARCHAR(50),
                DeleteDate    NVARCHAR(50),
                IsDelete      BIT
            )");

            Exec(conn, @"IF NOT EXISTS (SELECT * FROM sys.tables WHERE name='stores')
            CREATE TABLE stores (
                StoreNum  INT            PRIMARY KEY,
                StoreCode NVARCHAR(100),
                StoreName NVARCHAR(500),
                Status    NVARCHAR(100),
                SaveDate  NVARCHAR(50),
                IsDelete  BIT
            )");

            Exec(conn, @"IF NOT EXISTS (SELECT * FROM sys.tables WHERE name='store_stuffs')
            CREATE TABLE store_stuffs (
                StoreStuffNum  INT            PRIMARY KEY,
                StoreNum       INT,
                StuffNum       INT,
                AvailableCount DECIMAL(18,4),
                ReservedCount  DECIMAL(18,4),
                IsDelete       BIT
            )");

            Exec(conn, @"IF NOT EXISTS (SELECT * FROM sys.tables WHERE name='customers')
            CREATE TABLE customers (
                CompanyNum  INT            PRIMARY KEY,
                CompanyName NVARCHAR(500),
                CompanyCode NVARCHAR(100),
                Saver       NVARCHAR(200),
                Phone1      NVARCHAR(100),
                Mobile1     NVARCHAR(100),
                StateName1  NVARCHAR(200),
                CityName1   NVARCHAR(200),
                Address1    NVARCHAR(1000),
                PostCode1   NVARCHAR(500),
                TypeName    NVARCHAR(200)
            )");

            // اصلاح جداول موجود با ستون‌های کوچک‌تر
            Exec(conn, @"IF EXISTS (SELECT * FROM sys.columns WHERE object_id=OBJECT_ID('customers') AND name='PostCode1' AND max_length < 1000)
                ALTER TABLE customers ALTER COLUMN PostCode1 NVARCHAR(500)");
            Exec(conn, @"IF EXISTS (SELECT * FROM sys.columns WHERE object_id=OBJECT_ID('addresses') AND name='PostCode' AND max_length < 1000)
                ALTER TABLE addresses ALTER COLUMN PostCode NVARCHAR(500)");

            Exec(conn, @"IF NOT EXISTS (SELECT * FROM sys.tables WHERE name='phones')
            CREATE TABLE phones (
                RowNum      INT,
                Phone       NVARCHAR(100),
                Description NVARCHAR(500),
                Type        NVARCHAR(100),
                IsDefault   BIT,
                IsSms       BIT,
                CONSTRAINT PK_phones PRIMARY KEY (RowNum, Phone)
            )");

            Exec(conn, @"IF NOT EXISTS (SELECT * FROM sys.tables WHERE name='addresses')
            CREATE TABLE addresses (
                CompanyNum  INT            PRIMARY KEY,
                CountryName NVARCHAR(200),
                StateName   NVARCHAR(200),
                CityName    NVARCHAR(200),
                RegionName  NVARCHAR(200),
                Address     NVARCHAR(1000),
                PostCode    NVARCHAR(500),
                IsDefault   BIT
            )");

            Exec(conn, @"IF NOT EXISTS (SELECT * FROM sys.tables WHERE name='followers')
            CREATE TABLE followers (
                CompanyNum INT,
                UserName   NVARCHAR(200),
                FullName   NVARCHAR(500),
                CONSTRAINT PK_followers PRIMARY KEY (CompanyNum, UserName)
            )");

            Exec(conn, @"IF NOT EXISTS (SELECT * FROM sys.tables WHERE name='factors')
            CREATE TABLE factors (
                FactorID    INT            PRIMARY KEY,
                FactorNum   NVARCHAR(100),
                FactorDate  INT,
                MarketerNum INT,
                VisitorNum  INT,
                CompanyID   INT,
                Discount    DECIMAL(18,2),
                Tax         DECIMAL(18,2),
                FactorType  INT,
                Deleted     BIT
            )");

            Exec(conn, @"IF NOT EXISTS (SELECT * FROM sys.tables WHERE name='factor_rows')
            CREATE TABLE factor_rows (
                FactorRowNum INT            PRIMARY KEY,
                FactorID     INT,
                TotalPrice   DECIMAL(18,2),
                Qty          DECIMAL(18,4),
                UnitPrice    DECIMAL(18,2)
            )");

            Print("OK", ConsoleColor.Green);
        }

        // ─── سینک یک جدول ────────────────────────────────────────────────────
        static void SyncTable(string table, string query, string[] pkCols, bool doGC)
        {
            Console.Write($"  [{table}] خواندن... ");
            List<Dictionary<string, object>> rows;
            try
            {
                rows = ReadSrc(query);
            }
            catch (Exception ex)
            {
                Print($"خطا: {ex.Message}", ConsoleColor.Red);
                return;
            }
            Console.WriteLine($"{rows.Count} رکورد");

            var toUpsert = new List<Dictionary<string, object>>();
            var liveKeys = new HashSet<string>();

            foreach (var row in rows)
            {
                var pkDict = new Dictionary<string, object>();
                bool valid = true;
                foreach (var col in pkCols)
                {
                    if (!row.ContainsKey(col) || row[col] == null) { valid = false; break; }
                    pkDict[col] = row[col];
                }
                if (!valid) continue;

                string uid = $"{table}:::{JsonConvert.SerializeObject(pkDict)}";
                liveKeys.Add(uid);

                string hash = Hash(row);
                if (!Hashes.TryGetValue(uid, out var prev) || prev != hash)
                {
                    toUpsert.Add(row);
                    Hashes[uid] = hash;
                }
            }

            // Upsert رکوردهای تغییرکرده/جدید
            if (toUpsert.Count > 0)
            {
                Console.Write($"  [{table}] upsert {toUpsert.Count} رکورد... ");
                try
                {
                    using var conn = Open(DstConn);
                    foreach (var row in toUpsert)
                        Upsert(conn, table, row, pkCols);
                    Print("OK", ConsoleColor.Green);
                }
                catch (Exception ex)
                {
                    Print($"خطا: {ex.Message}", ConsoleColor.Red);
                    // برگرداندن hash‌ها تا دور بعد دوباره تلاش شود
                    foreach (var row in toUpsert)
                    {
                        var pkDict = new Dictionary<string, object>();
                        foreach (var col in pkCols) pkDict[col] = row[col];
                        Hashes.Remove($"{table}:::{JsonConvert.SerializeObject(pkDict)}");
                    }
                }
            }

            // حذف رکوردهایی که از سورس پاک شده‌اند
            var toDelete = Hashes.Keys
                .Where(k => k.StartsWith($"{table}:::") && !liveKeys.Contains(k))
                .ToList();

            if (toDelete.Count > 0)
            {
                Console.Write($"  [{table}] حذف {toDelete.Count} رکورد... ");
                try
                {
                    using var conn = Open(DstConn);
                    foreach (var uid in toDelete)
                    {
                        var pkJson = uid.Substring(table.Length + 3);
                        var pk = JsonConvert.DeserializeObject<Dictionary<string, object>>(pkJson)!;
                        DeleteRow(conn, table, pk, pkCols);
                        Hashes.Remove(uid);
                    }
                    Print("OK", ConsoleColor.Green);
                }
                catch (Exception ex)
                {
                    Print($"خطا: {ex.Message}", ConsoleColor.Red);
                }
            }
        }

        // ─── عملیات SQL ───────────────────────────────────────────────────────
        static void Upsert(SqlConnection conn, string table, Dictionary<string, object> row, string[] pkCols)
        {
            var cols = row.Keys.ToList();
            var updateCols = cols.Where(c => !pkCols.Contains(c)).ToList();

            var sb = new StringBuilder();
            sb.AppendLine($"MERGE [{table}] AS t");
            sb.AppendLine($"USING (SELECT {string.Join(", ", cols.Select(c => $"@p_{c} AS [{c}]"))}) AS s");
            sb.AppendLine($"ON {string.Join(" AND ", pkCols.Select(c => $"t.[{c}] = s.[{c}]"))}");
            if (updateCols.Count > 0)
            {
                sb.AppendLine("WHEN MATCHED THEN UPDATE SET");
                sb.AppendLine("  " + string.Join(", ", updateCols.Select(c => $"t.[{c}] = s.[{c}]")));
            }
            sb.AppendLine($"WHEN NOT MATCHED THEN INSERT ({string.Join(", ", cols.Select(c => $"[{c}]"))})");
            sb.AppendLine($"  VALUES ({string.Join(", ", cols.Select(c => $"s.[{c}]"))});");

            using var cmd = new SqlCommand(sb.ToString(), conn);
            foreach (var col in cols)
            {
                var val = row[col];
                if (col == "Address" && val is string sv && sv.Length > 1000)
                    val = sv[..1000];
                cmd.Parameters.AddWithValue($"@p_{col}", val ?? DBNull.Value);
            }
            cmd.CommandTimeout = 30;
            cmd.ExecuteNonQuery();
        }

        static void DeleteRow(SqlConnection conn, string table, Dictionary<string, object> pk, string[] pkCols)
        {
            string where = string.Join(" AND ", pkCols.Select(c => $"[{c}] = @p_{c}"));
            using var cmd = new SqlCommand($"DELETE FROM [{table}] WHERE {where}", conn);
            foreach (var col in pkCols)
                cmd.Parameters.AddWithValue($"@p_{col}", pk.ContainsKey(col) ? pk[col] ?? DBNull.Value : DBNull.Value);
            cmd.ExecuteNonQuery();
        }

        // ─── کوئری‌های سورس ──────────────────────────────────────────────────
        static string GetStuffsQ() => @"
            SELECT StuffNum, ParentNum, StuffName, StuffCode, TechnicalCode,
                   IranCode, Barcode, Price, Active,
                   CONVERT(NVARCHAR(50), SaveDate,   120) AS SaveDate,
                   CONVERT(NVARCHAR(50), EditDate,   120) AS EditDate,
                   CONVERT(NVARCHAR(50), DeleteDate, 120) AS DeleteDate,
                   IsDelete
            FROM Stuff";

        static string GetStoresQ() => @"
            SELECT StoreNum, StoreCode, StoreName, Status,
                   CONVERT(NVARCHAR(50), SaveDate, 120) AS SaveDate, IsDelete
            FROM Store";

        static string GetStoreStuffsQ() => @"
            SELECT StoreStuffNum, StoreNum, StuffNum,
                   AvailableCount, ReservedCount, IsDelete
            FROM StoreStuff";

        static string GetCustomersQ() => @"
            SELECT CompanyNum, CompanyName, CompanyCode, Saver,
                   Phone1, Mobile1, StateName1, CityName1,
                   LEFT(Address1, 1000) AS Address1,
                   LEFT(PostCode1, 500) AS PostCode1, TypeName
            FROM VCompany";

        static string GetPhonesQ() => @"
            SELECT Phone, Description, Type, RowNum, IsDefault, IsSms
            FROM Phone
            WHERE IsDelete = 0 AND (TblName='VCompany' OR TblName='Company')";

        static string GetAddressesQ() => @"
            SELECT CompanyNum, CountryName, StateName, CityName, RegionName,
                   LEFT(Address, 1000) AS Address,
                   LEFT(PostCode, 500) AS PostCode, IsDefault
            FROM CompanyRegion
            WHERE IsDelete = 0";

        static string GetFollowersQ() => @"
            SELECT cu.CompanyNum, cu.UserName, u.Name AS FullName
            FROM CompanyUsers cu
            INNER JOIN Users u ON cu.UserName = u.UserName";

        static string GetFactorsQ() => @"
            SELECT FactorID, FactorNum, FactorDate,
                   MarketerNum, VisitorNum, CompanyID,
                   COALESCE(Discount, 0) AS Discount,
                   COALESCE(Tax, 0) AS Tax,
                   FactorType,
                   COALESCE(Deleted, 0) AS Deleted
            FROM Factor
            WHERE FactorType = 1";

        static string GetFactorRowsQ() => @"
            SELECT fr.FactorRowNum, fr.FactorID,
                   COALESCE(fr.TotalPrice, 0) AS TotalPrice,
                   COALESCE(fr.Qty, 0) AS Qty,
                   COALESCE(fr.UnitPrice, 0) AS UnitPrice
            FROM FactorRow fr
            INNER JOIN Factor f ON f.FactorID = fr.FactorID
            WHERE f.FactorType = 1 AND COALESCE(f.Deleted, 0) = 0";

        // ─── کمکی ────────────────────────────────────────────────────────────
        static List<Dictionary<string, object>> ReadSrc(string query)
        {
            var list = new List<Dictionary<string, object>>();
            using var conn = Open(SrcConn);
            using var cmd  = new SqlCommand(query, conn) { CommandTimeout = 120 };
            using var dr   = cmd.ExecuteReader();
            while (dr.Read())
            {
                var row = new Dictionary<string, object>();
                for (int i = 0; i < dr.FieldCount; i++)
                {
                    var v = dr.GetValue(i);
                    if (v is string s) v = s.Trim();
                    row[dr.GetName(i)] = (v == DBNull.Value) ? null! : v;
                }
                list.Add(row);
            }
            return list;
        }

        static SqlConnection Open(string cs)
        {
            var c = new SqlConnection(cs);
            c.Open();
            return c;
        }

        static void Exec(SqlConnection c, string sql)
        {
            using var cmd = new SqlCommand(sql, c) { CommandTimeout = 60 };
            cmd.ExecuteNonQuery();
        }

        static string Hash(Dictionary<string, object> row)
        {
            string s = JsonConvert.SerializeObject(row);
            using var sha = SHA256.Create();
            return BitConverter.ToString(sha.ComputeHash(Encoding.UTF8.GetBytes(s))).Replace("-", "").ToLower();
        }

        static void LoadHashes()
        {
            try
            {
                if (File.Exists(HashFile))
                    Hashes = JsonConvert.DeserializeObject<Dictionary<string, string>>(File.ReadAllText(HashFile))
                             ?? new Dictionary<string, string>();
                Print($"hash‌های قبلی بارگذاری شد: {Hashes.Count} رکورد", ConsoleColor.DarkGray);
            }
            catch { Hashes = new Dictionary<string, string>(); }
        }

        static void SaveHashes()
        {
            try { File.WriteAllText(HashFile, JsonConvert.SerializeObject(Hashes, Formatting.None)); } catch { }
        }

        static void ShowColumns(string tableName)
        {
            try
            {
                var cols = new List<string>();
                using var conn = Open(SrcConn);
                using var cmd = new SqlCommand(
                    $"SELECT COLUMN_NAME, DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS " +
                    $"WHERE TABLE_NAME='{tableName}' ORDER BY ORDINAL_POSITION", conn);
                using var dr = cmd.ExecuteReader();
                while (dr.Read())
                    cols.Add($"{dr.GetString(0)} ({dr.GetString(1)})");
                Print($"{tableName}: {string.Join(", ", cols)}", ConsoleColor.Yellow);
            }
            catch (Exception ex)
            {
                Print($"{tableName}: خطا — {ex.Message}", ConsoleColor.Red);
            }
        }

        static void Print(string msg, ConsoleColor color = ConsoleColor.Gray)
        {
            Console.ForegroundColor = color;
            Console.WriteLine(msg);
            Console.ResetColor();
        }

        static string Now() => DateTime.Now.ToString("HH:mm:ss");
    }
}
