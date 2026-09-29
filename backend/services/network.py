import ipaddress
import socket


def detect_lan_ip() -> str | None:
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as network_socket:
            network_socket.connect(("8.8.8.8", 80))
            address = network_socket.getsockname()[0]
    except OSError:
        return None

    try:
        parsed_address = ipaddress.ip_address(address)
    except ValueError:
        return None
    if parsed_address.version != 4 or parsed_address.is_loopback:
        return None
    return str(parsed_address)