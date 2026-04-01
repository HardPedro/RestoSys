using System.Collections.Generic;

namespace PrintAgent
{
    public class PrintConfig
    {
        public PrinterConfig Cozinha { get; set; }
        public PrinterConfig Bar { get; set; }
        public PrinterConfig Caixa { get; set; }
    }

    public class PrinterConfig
    {
        public string Printer { get; set; }
        public string Tipo { get; set; }
        public int Largura { get; set; }
    }

    public class PrintRequest
    {
        public string PedidoId { get; set; }
        public List<PrintItem> Itens { get; set; }
        public bool ImprimirCaixa { get; set; }
        public string Tipo { get; set; } 
        public decimal Total { get; set; }
        public string Pagamento { get; set; }
        public string Mesa { get; set; }
    }

    public class PrintItem
    {
        public string Nome { get; set; }
        public string Setor { get; set; }
        public int Quantidade { get; set; }
        public string Observacao { get; set; }
        public decimal Preco { get; set; }
    }
}
