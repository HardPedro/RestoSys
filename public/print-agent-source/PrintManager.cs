using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.Drawing;
using System.Drawing.Printing;
using System.IO;
using System.Linq;
using System.Text.Json;
using System.Threading.Tasks;

namespace PrintAgent
{
    public class PrintManager
    {
        private ConcurrentQueue<PrintRequest> queue = new ConcurrentQueue<PrintRequest>();
        private PrintConfig config;

        public PrintManager()
        {
            LoadConfig();
            Task.Run(() => ProcessQueue());
        }

        public void LoadConfig()
        {
            if (File.Exists("config.json"))
            {
                try
                {
                    string json = File.ReadAllText("config.json");
                    config = JsonSerializer.Deserialize<PrintConfig>(json, new JsonSerializerOptions { PropertyNameCaseInsensitive = true });
                }
                catch { }
            }
            if (config == null) config = new PrintConfig();
        }

        public void Enqueue(PrintRequest request)
        {
            queue.Enqueue(request);
        }

        private async Task ProcessQueue()
        {
            while (true)
            {
                if (queue.TryDequeue(out var request))
                {
                    try
                    {
                        ProcessPrintRequest(request);
                    }
                    catch (Exception ex)
                    {
                        Console.WriteLine("Print error: " + ex.Message);
                    }
                }
                await Task.Delay(500);
            }
        }

        private void ProcessPrintRequest(PrintRequest req)
        {
            var kitchenItems = req.Itens?.Where(i => i.Setor == "kitchen" || i.Setor == "cozinha").ToList();
            var barItems = req.Itens?.Where(i => i.Setor == "bar").ToList();

            if (kitchenItems != null && kitchenItems.Any() && config.Cozinha != null && !string.IsNullOrEmpty(config.Cozinha.Printer))
            {
                PrintSector("COZINHA", kitchenItems, config.Cozinha, req);
            }

            if (barItems != null && barItems.Any() && config.Bar != null && !string.IsNullOrEmpty(config.Bar.Printer))
            {
                PrintSector("BAR", barItems, config.Bar, req);
            }

            if (req.ImprimirCaixa && config.Caixa != null && !string.IsNullOrEmpty(config.Caixa.Printer))
            {
                PrintReceipt(req, config.Caixa);
            }
        }

        private void PrintSector(string sectorName, List<PrintItem> items, PrinterConfig pConfig, PrintRequest req)
        {
            PrintDocument pd = new PrintDocument();
            pd.PrinterSettings.PrinterName = pConfig.Printer;
            
            pd.PrintPage += (sender, e) =>
            {
                Graphics g = e.Graphics;
                Font font = new Font("Courier New", 10);
                Font boldFont = new Font("Courier New", 10, FontStyle.Bold);
                Font titleFont = new Font("Courier New", 14, FontStyle.Bold);
                
                float yPos = 0;
                int leftMargin = 0;
                
                g.DrawString($"--- {sectorName} ---", titleFont, Brushes.Black, leftMargin, yPos);
                yPos += 30;
                g.DrawString($"Data: {DateTime.Now.ToString("dd/MM/yyyy HH:mm")}", font, Brushes.Black, leftMargin, yPos);
                yPos += 20;
                g.DrawString($"Mesa: {req.Mesa}", boldFont, Brushes.Black, leftMargin, yPos);
                yPos += 20;
                g.DrawString($"Pedido: #{req.PedidoId}", font, Brushes.Black, leftMargin, yPos);
                yPos += 30;

                g.DrawString("Qtd  Item", boldFont, Brushes.Black, leftMargin, yPos);
                yPos += 20;
                g.DrawString(new string('-', 30), font, Brushes.Black, leftMargin, yPos);
                yPos += 20;

                foreach (var item in items)
                {
                    g.DrawString($"{item.Quantidade}x   {item.Nome}", boldFont, Brushes.Black, leftMargin, yPos);
                    yPos += 20;
                    if (!string.IsNullOrEmpty(item.Observacao))
                    {
                        g.DrawString($"     OBS: {item.Observacao}", font, Brushes.Black, leftMargin, yPos);
                        yPos += 20;
                    }
                }
                
                yPos += 20;
                g.DrawString("--- FIM ---", font, Brushes.Black, leftMargin, yPos);
            };

            pd.Print();
        }

        private void PrintReceipt(PrintRequest req, PrinterConfig pConfig)
        {
            PrintDocument pd = new PrintDocument();
            pd.PrinterSettings.PrinterName = pConfig.Printer;
            
            pd.PrintPage += (sender, e) =>
            {
                Graphics g = e.Graphics;
                Font font = new Font("Courier New", 10);
                Font boldFont = new Font("Courier New", 10, FontStyle.Bold);
                Font titleFont = new Font("Courier New", 12, FontStyle.Bold);
                
                float yPos = 0;
                int leftMargin = 0;
                
                g.DrawString("RESTAURANTE EXPRESS", titleFont, Brushes.Black, leftMargin, yPos);
                yPos += 25;
                g.DrawString(req.Tipo == "preconta" ? "Conferencia de Mesa" : "Cupom Nao Fiscal", font, Brushes.Black, leftMargin, yPos);
                yPos += 20;
                g.DrawString(DateTime.Now.ToString("dd/MM/yyyy HH:mm:ss"), font, Brushes.Black, leftMargin, yPos);
                yPos += 20;
                g.DrawString($"Mesa: {req.Mesa}", boldFont, Brushes.Black, leftMargin, yPos);
                yPos += 20;
                g.DrawString($"Pedido: #{req.PedidoId}", font, Brushes.Black, leftMargin, yPos);
                yPos += 30;

                if (req.Itens != null)
                {
                    foreach (var item in req.Itens)
                    {
                        g.DrawString($"{item.Quantidade}x {item.Nome}", font, Brushes.Black, leftMargin, yPos);
                        g.DrawString($"R$ {(item.Preco * item.Quantidade).ToString("F2")}", font, Brushes.Black, leftMargin + 150, yPos);
                        yPos += 20;
                    }
                }

                yPos += 10;
                g.DrawString(new string('-', 30), font, Brushes.Black, leftMargin, yPos);
                yPos += 20;
                
                g.DrawString("TOTAL", boldFont, Brushes.Black, leftMargin, yPos);
                g.DrawString($"R$ {req.Total.ToString("F2")}", boldFont, Brushes.Black, leftMargin + 150, yPos);
                yPos += 30;

                if (!string.IsNullOrEmpty(req.Pagamento))
                {
                    g.DrawString($"Pagamento: {req.Pagamento}", font, Brushes.Black, leftMargin, yPos);
                    yPos += 20;
                }

                g.DrawString("Obrigado pela preferencia!", font, Brushes.Black, leftMargin, yPos);
            };

            pd.Print();
        }
    }
}
