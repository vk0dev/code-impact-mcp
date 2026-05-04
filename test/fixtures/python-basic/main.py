try:
    import missing_lib
except ImportError:
    from pkg import fallback
