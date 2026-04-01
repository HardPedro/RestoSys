using System;
using System.Drawing;
using System.Windows.Forms;

namespace PrintAgent
{
    public class TrayApplicationContext : ApplicationContext
    {
        private NotifyIcon trayIcon;
        private HttpServer server;

        public TrayApplicationContext()
        {
            trayIcon = new NotifyIcon()
            {
                Icon = SystemIcons.Application,
                ContextMenuStrip = new ContextMenuStrip(),
                Visible = true,
                Text = "Agente de Impressão Local"
            };

            trayIcon.ContextMenuStrip.Items.Add(new ToolStripMenuItem("Status: Online") { Enabled = false });
            trayIcon.ContextMenuStrip.Items.Add(new ToolStripSeparator());
            trayIcon.ContextMenuStrip.Items.Add(new ToolStripMenuItem("Sair", Exit));

            server = new HttpServer();
            server.Start();
        }

        void Exit(object sender, EventArgs e)
        {
            server.Stop();
            trayIcon.Visible = false;
            Application.Exit();
        }
    }
}
