from services import network


class StubSocket:
    def __init__(self, address: str = "192.168.1.12", error: OSError | None = None):
        self.address = address
        self.error = error
        self.closed = False

    def __enter__(self):
        return self

    def __exit__(self, *_args):
        self.closed = True

    def connect(self, _target):
        if self.error:
            raise self.error

    def getsockname(self):
        return self.address, 0


def test_detect_lan_ip_returns_selected_ipv4(monkeypatch):
    stub_socket = StubSocket()
    monkeypatch.setattr(network.socket, "socket", lambda *_args: stub_socket)

    assert network.detect_lan_ip() == "192.168.1.12"
    assert stub_socket.closed is True


def test_detect_lan_ip_returns_none_when_network_route_is_unavailable(monkeypatch):
    stub_socket = StubSocket(error=OSError("No route to host"))
    monkeypatch.setattr(network.socket, "socket", lambda *_args: stub_socket)

    assert network.detect_lan_ip() is None
    assert stub_socket.closed is True


def test_detect_lan_ip_rejects_loopback(monkeypatch):
    stub_socket = StubSocket(address="127.0.0.1")
    monkeypatch.setattr(network.socket, "socket", lambda *_args: stub_socket)

    assert network.detect_lan_ip() is None