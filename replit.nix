{pkgs}: {
  deps = [
    pkgs.gtk3
    pkgs.dbus-glib
    pkgs.xorg.libxcb
    pkgs.xorg.libX11
    pkgs.xorg.libXext
    pkgs.xorg.libxshmfence
    pkgs.xorg.libXrandr
    pkgs.xorg.libXdamage
    pkgs.xorg.libXcomposite
    pkgs.alsa-lib
    pkgs.cairo
    pkgs.pango
    pkgs.mesa
    pkgs.libdrm
    pkgs.cups
    pkgs.at-spi2-atk
    pkgs.nss
    pkgs.chromium
  ];
}
